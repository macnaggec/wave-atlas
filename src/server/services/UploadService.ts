import { randomUUID } from 'node:crypto';
import { MediaType } from '@prisma/client';
import { ForbiddenError, NotFoundError } from 'shared/errors';
import { logger } from 'shared/lib/logger';
import type { IUploadAttemptRepository } from 'server/repositories/UploadAttemptRepository';
import type { DirectUploadPort, RemoteImportPort, AssetCleanupPort } from 'server/ports/UploadAssetStorage';
import type { ISurfSessionRepository } from 'server/repositories/SurfSessionRepository';
import type { DirectUploadGrant, UploadAttemptProjection } from 'shared/types/upload';

const GRANT_TTL_MS   = 60 * 60 * 1000;          // 1 hour
const ATTEMPT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function mimeToMediaType(mime: string): MediaType {
  return mime.startsWith('video/') ? 'VIDEO' : 'PHOTO';
}

export class UploadService {
  constructor(
    private repo: IUploadAttemptRepository,
    private direct: DirectUploadPort,
    private remote: RemoteImportPort,
    private cleanup: AssetCleanupPort,
    private sessions: Pick<ISurfSessionRepository, 'findDraftById'>,
  ) {}

  async beginLocal(
    photographerId: string,
    input: { draftId: string; clientRequestId: string; declaredMimeType: string; declaredByteSize: number },
  ): Promise<DirectUploadGrant> {
    logger.info('[upload] beginLocal', { photographerId, draftId: input.draftId, clientRequestId: input.clientRequestId });
    const draft = await this.sessions.findDraftById(input.draftId);
    if (!draft) throw new NotFoundError('Surf Session');
    if (draft.photographerId !== photographerId) throw new ForbiddenError('You do not have permission to upload to this session');

    const expectedMediaType = mimeToMediaType(input.declaredMimeType);
    const cloudinaryPublicId = `wave-atlas/users/${photographerId}/${randomUUID()}`;
    const uploadGrantExpiresAt = new Date(Date.now() + GRANT_TTL_MS);
    const expiresAt = new Date(Date.now() + ATTEMPT_TTL_MS);

    const attempt = await this.repo.beginLocalIdempotent({
      clientRequestId: input.clientRequestId,
      sessionId: input.draftId,
      photographerId,
      cloudinaryPublicId,
      expectedMediaType,
      uploadGrantExpiresAt,
      expiresAt,
    });

    const grant = this.direct.createUploadGrant(
      { cloudinaryPublicId: attempt.cloudinaryPublicId, expectedMediaType, photographerId },
      uploadGrantExpiresAt,
    );
    return { ...grant, attemptId: attempt.id };
  }

  async finalizeLocal(
    photographerId: string,
    input: { attemptId: string; providerReceipt: unknown; capturedAt?: Date },
  ): Promise<{ mediaId: string }> {
    logger.info('[upload] finalizeLocal', { photographerId, attemptId: input.attemptId });
    const attempt = await this.repo.findByIdForPhotographer(input.attemptId, photographerId);
    if (!attempt) throw new NotFoundError('UploadAttempt');

    const asset = await this.direct.verifyUploadReceipt(input.providerReceipt, {
      cloudinaryPublicId: attempt.cloudinaryPublicId,
      expectedMediaType: 'PHOTO',
      photographerId,
    });

    const media = await this.repo.finalizeIntoDraft(input.attemptId, photographerId, {
      capturedAt: input.capturedAt ?? new Date(),
      thumbnailUrl: asset.thumbnailUrl,
      lightboxUrl: asset.lightboxUrl,
      resourceType: asset.resourceType,
    });

    return { mediaId: media.id };
  }

  async beginDrive(
    photographerId: string,
    input: { draftId: string; clientRequestId: string; remoteFileId: string; declaredMimeType: string },
  ): Promise<{ attemptId: string }> {
    const draft = await this.sessions.findDraftById(input.draftId);
    if (!draft) throw new NotFoundError('Surf Session');
    if (draft.photographerId !== photographerId) throw new ForbiddenError('You do not have permission to upload to this session');

    const expectedMediaType = mimeToMediaType(input.declaredMimeType);
    const cloudinaryPublicId = `wave-atlas/users/${photographerId}/${randomUUID()}`;

    const attempt = await this.repo.beginDriveIdempotent({
      clientRequestId: input.clientRequestId,
      sessionId: input.draftId,
      photographerId,
      cloudinaryPublicId,
      expectedMediaType,
      remoteFileId: input.remoteFileId,
      uploadGrantExpiresAt: new Date(Date.now() + GRANT_TTL_MS),
      expiresAt: new Date(Date.now() + ATTEMPT_TTL_MS),
    });

    return { attemptId: attempt.id };
  }

  async processDrive(
    photographerId: string,
    input: { attemptId: string; accessToken: string },
  ): Promise<void> {
    await this.repo.markAcquiring(input.attemptId, photographerId);

    const attempt = await this.repo.findByIdForPhotographer(input.attemptId, photographerId);
    if (!attempt) throw new NotFoundError('UploadAttempt');

    let asset;
    try {
      asset = await this.remote.importRemoteFile({
        sourceUrl: `https://www.googleapis.com/drive/v3/files/${(attempt as any).remoteFileId}?alt=media`,
        authHeaders: { Authorization: `Bearer ${input.accessToken}` },
        target: { cloudinaryPublicId: attempt.cloudinaryPublicId, expectedMediaType: 'PHOTO', photographerId },
      });
    } catch (err) {
      await this.repo.cancelAttempt(input.attemptId, photographerId);
      throw err;
    }

    // Re-read to check for cancellation that arrived during import.
    const current = await this.repo.findByIdForPhotographer(input.attemptId, photographerId);
    if (current?.status === 'CANCEL_REQUESTED') {
      await this.cleanup.deleteStoredAsset({ cloudinaryPublicId: asset.cloudinaryPublicId, resourceType: asset.resourceType });
      return;
    }

    await this.repo.finalizeIntoDraft(input.attemptId, photographerId, {
      capturedAt: new Date(),
      thumbnailUrl: asset.thumbnailUrl,
      lightboxUrl: asset.lightboxUrl,
      resourceType: asset.resourceType,
    });
  }

  listForDraft(photographerId: string, sessionId: string): Promise<UploadAttemptProjection[]> {
    return this.repo.listForDraft(sessionId, photographerId);
  }

  async discardDraft(photographerId: string, draftId: string): Promise<void> {
    const draft = await this.sessions.findDraftById(draftId);
    if (!draft) throw new NotFoundError('Surf Session');
    if (draft.photographerId !== photographerId) throw new ForbiddenError('You do not have permission');

    const assetsToClean = await this.repo.removeCompletedDraftMedia(draftId, photographerId);

    // Best-effort provider cleanup — failures leave CLEANUP_PENDING for reconciler.
    await Promise.allSettled(
      assetsToClean.map(asset =>
        this.cleanup.deleteStoredAsset({ cloudinaryPublicId: asset.cloudinaryPublicId, resourceType: asset.resourceType }),
      ),
    );
  }

  async discardAttempt(photographerId: string, attemptId: string): Promise<void> {
    await this.repo.cancelAttempt(attemptId, photographerId);
    // Best-effort provider cleanup for asset that was already uploaded.
    const attempt = await this.repo.findByIdForPhotographer(attemptId, photographerId);
    if (attempt?.status === 'CANCEL_REQUESTED' && attempt.cloudinaryPublicId) {
      void this.cleanup.deleteStoredAsset({ cloudinaryPublicId: attempt.cloudinaryPublicId, resourceType: 'PHOTO' })
        .catch(() => { /* logged by reconciler */ });
    }
  }
}

import { uploadAttemptRepository } from 'server/repositories/UploadAttemptRepository';
import { cloudinaryService } from './CloudinaryService';
import { surfSessionRepository } from 'server/repositories/SurfSessionRepository';

export const uploadService = new UploadService(
  uploadAttemptRepository,
  cloudinaryService,
  cloudinaryService,
  cloudinaryService,
  surfSessionRepository,
);
