import { MediaType, UploadAttemptStatus } from '@prisma/client';
import { prisma } from 'server/db';
import { runQuery } from 'server/lib/PrismaErrorMapper';
import { BadRequestError, NotFoundError } from 'shared/errors';
import type { UploadAttemptProjection } from 'shared/types/upload';

export type BeginLocalInput = {
  clientRequestId: string;
  sessionId: string;
  photographerId: string;
  cloudinaryPublicId: string;
  expectedMediaType: MediaType;
  uploadGrantExpiresAt?: Date;
  expiresAt: Date;
};

export type FinalizeMediaInput = {
  capturedAt: Date;
  thumbnailUrl: string;
  lightboxUrl: string;
  resourceType: MediaType;
};

const CANCELLABLE_STATUSES: UploadAttemptStatus[] = [
  'READY', 'ACQUIRING', 'FINALIZING', 'FAILED',
];

export interface IUploadAttemptRepository {
  beginLocalIdempotent(input: BeginLocalInput): Promise<UploadAttemptProjection>;
  beginDriveIdempotent(input: BeginLocalInput & { remoteFileId: string }): Promise<UploadAttemptProjection>;
  markAcquiring(attemptId: string, photographerId: string): Promise<void>;
  finalizeIntoDraft(attemptId: string, photographerId: string, media: FinalizeMediaInput): Promise<{ id: string; uploadAttemptId: string }>;
  cancelAttempt(attemptId: string, photographerId: string): Promise<void>;
  findByIdForPhotographer(attemptId: string, photographerId: string): Promise<UploadAttemptProjection | null>;
  listForDraft(sessionId: string, photographerId: string): Promise<UploadAttemptProjection[]>;
  hasBlockingAttempts(sessionId: string): Promise<boolean>;
  removeCompletedDraftMedia(sessionId: string, photographerId: string): Promise<Array<{ cloudinaryPublicId: string; resourceType: MediaType }>>;
  findExpiredForReconciliation(): Promise<Array<{
    id: string;
    cloudinaryPublicId: string;
    expectedMediaType: MediaType;
    status: UploadAttemptStatus;
  }>>;
  markCancelled(attemptId: string): Promise<void>;
}

function toProjection(row: {
  id: string; clientRequestId: string; source: string; status: string;
  cloudinaryPublicId: string; lastErrorCode: string | null; createdAt: Date;
}): UploadAttemptProjection {
  return {
    id: row.id,
    clientRequestId: row.clientRequestId,
    source: row.source as UploadAttemptProjection['source'],
    status: row.status as UploadAttemptProjection['status'],
    cloudinaryPublicId: row.cloudinaryPublicId,
    errorCode: row.lastErrorCode,
    createdAt: row.createdAt,
  };
}

export class UploadAttemptRepository implements IUploadAttemptRepository {
  beginLocalIdempotent(input: BeginLocalInput): Promise<UploadAttemptProjection> {
    return runQuery(async () => {
      const existing = await prisma.uploadAttempt.findUnique({
        where: { photographerId_clientRequestId: { photographerId: input.photographerId, clientRequestId: input.clientRequestId } },
      });
      if (existing) return toProjection(existing);
      return toProjection(await prisma.uploadAttempt.create({
        data: {
          clientRequestId: input.clientRequestId,
          sessionId: input.sessionId,
          photographerId: input.photographerId,
          source: 'LOCAL',
          cloudinaryPublicId: input.cloudinaryPublicId,
          expectedMediaType: input.expectedMediaType,
          uploadGrantExpiresAt: input.uploadGrantExpiresAt,
          expiresAt: input.expiresAt,
        },
      }));
    });
  }

  beginDriveIdempotent(input: BeginLocalInput & { remoteFileId: string }): Promise<UploadAttemptProjection> {
    return runQuery(async () => {
      const existing = await prisma.uploadAttempt.findUnique({
        where: { photographerId_clientRequestId: { photographerId: input.photographerId, clientRequestId: input.clientRequestId } },
      });
      if (existing) return toProjection(existing);
      return toProjection(await prisma.uploadAttempt.create({
        data: {
          clientRequestId: input.clientRequestId,
          sessionId: input.sessionId,
          photographerId: input.photographerId,
          source: 'DRIVE',
          cloudinaryPublicId: input.cloudinaryPublicId,
          expectedMediaType: input.expectedMediaType,
          remoteFileId: input.remoteFileId,
          expiresAt: input.expiresAt,
        },
      }));
    });
  }

  markAcquiring(attemptId: string, photographerId: string): Promise<void> {
    return runQuery(async () => {
      const result = await prisma.uploadAttempt.updateMany({
        where: { id: attemptId, photographerId, status: 'READY' },
        data: { status: 'ACQUIRING' },
      });
      if (result.count === 0) {
        const attempt = await prisma.uploadAttempt.findUnique({ where: { id: attemptId } });
        if (!attempt || attempt.photographerId !== photographerId) throw new NotFoundError('UploadAttempt');
        if (attempt.status !== 'ACQUIRING') throw new BadRequestError('Attempt cannot be acquired in its current state');
      }
    });
  }

  finalizeIntoDraft(attemptId: string, photographerId: string, media: FinalizeMediaInput): Promise<{ id: string; uploadAttemptId: string }> {
    return runQuery(async () => {
      const attempt = await prisma.uploadAttempt.findUnique({ where: { id: attemptId } });
      if (!attempt || attempt.photographerId !== photographerId) throw new NotFoundError('UploadAttempt');
      if (!(['READY', 'ACQUIRING', 'FINALIZING'] as UploadAttemptStatus[]).includes(attempt.status)) {
        throw new BadRequestError('Attempt is not eligible for finalization');
      }

      return prisma.$transaction(async (tx) => {
        const claimed = await tx.uploadAttempt.updateMany({
          where: { id: attemptId, photographerId, status: { in: ['READY', 'ACQUIRING', 'FINALIZING'] } },
          data: { status: 'FINALIZING' },
        });
        if (claimed.count === 0) throw new BadRequestError('Attempt was cancelled or already finalized');

        const mediaRow = await tx.mediaItem.create({
          data: {
            sessionId: attempt.sessionId,
            photographerId: attempt.photographerId,
            cloudinaryPublicId: attempt.cloudinaryPublicId,
            type: media.resourceType,
            thumbnailUrl: media.thumbnailUrl,
            lightboxUrl: media.lightboxUrl,
            capturedAt: media.capturedAt,
            importSource: attempt.source === 'DRIVE' ? 'GOOGLE_DRIVE' : 'DIRECT',
            remoteFileId: attempt.remoteFileId ?? undefined,
            uploadAttemptId: attemptId,
          },
        });

        await tx.uploadAttempt.update({ where: { id: attemptId }, data: { status: 'COMPLETED' } });
        return { id: mediaRow.id, uploadAttemptId: attemptId };
      });
    });
  }

  cancelAttempt(attemptId: string, photographerId: string): Promise<void> {
    return runQuery(async () => {
      const result = await prisma.uploadAttempt.updateMany({
        where: { id: attemptId, photographerId, status: { in: CANCELLABLE_STATUSES } },
        data: { status: 'CANCEL_REQUESTED' },
      });
      if (result.count === 0) {
        const attempt = await prisma.uploadAttempt.findUnique({ where: { id: attemptId } });
        if (!attempt || attempt.photographerId !== photographerId) throw new NotFoundError('UploadAttempt');
        // Already in CANCEL_REQUESTED, CLEANUP_PENDING, or CANCELLED — idempotent
      }
    });
  }

  findByIdForPhotographer(attemptId: string, photographerId: string): Promise<UploadAttemptProjection | null> {
    return runQuery(async () => {
      const row = await prisma.uploadAttempt.findUnique({ where: { id: attemptId } });
      if (!row || row.photographerId !== photographerId) return null;
      return toProjection(row);
    });
  }

  listForDraft(sessionId: string, photographerId: string): Promise<UploadAttemptProjection[]> {
    return runQuery(async () => {
      const rows = await prisma.uploadAttempt.findMany({
        where: {
          sessionId,
          photographerId,
          status: { notIn: ['COMPLETED', 'CANCELLED'] },
        },
        orderBy: { createdAt: 'asc' },
      });
      return rows.map(toProjection);
    });
  }

  hasBlockingAttempts(sessionId: string): Promise<boolean> {
    return runQuery(async () => {
      const count = await prisma.uploadAttempt.count({
        where: {
          sessionId,
          status: { in: ['READY', 'ACQUIRING', 'FINALIZING', 'FAILED'] },
        },
      });
      return count > 0;
    });
  }

  removeCompletedDraftMedia(
    sessionId: string,
    photographerId: string,
  ): Promise<Array<{ cloudinaryPublicId: string; resourceType: MediaType }>> {
    return runQuery(async () => {
      return prisma.$transaction(async (tx) => {
        // Cancel all nonterminal attempts first.
        await tx.uploadAttempt.updateMany({
          where: {
            sessionId,
            photographerId,
            status: { in: ['READY', 'ACQUIRING', 'FINALIZING', 'FAILED', 'CANCEL_REQUESTED'] },
          },
          data: { status: 'CANCEL_REQUESTED' },
        });

        // Collect COMPLETED attempt asset identities before deleting media.
        const completedAttempts = await tx.uploadAttempt.findMany({
          where: { sessionId, photographerId, status: 'COMPLETED' },
          select: { id: true, cloudinaryPublicId: true, expectedMediaType: true },
        });

        if (completedAttempts.length > 0) {
          await tx.mediaItem.deleteMany({
            where: {
              uploadAttemptId: { in: completedAttempts.map(a => a.id) },
              deletedAt: null,
            },
          });
          await tx.uploadAttempt.updateMany({
            where: { id: { in: completedAttempts.map(a => a.id) } },
            data: { status: 'CLEANUP_PENDING' },
          });
        }

        return completedAttempts.map(a => ({
          cloudinaryPublicId: a.cloudinaryPublicId,
          resourceType: a.expectedMediaType,
        }));
      });
    });
  }

  findExpiredForReconciliation(): Promise<Array<{
    id: string;
    cloudinaryPublicId: string;
    expectedMediaType: MediaType;
    status: UploadAttemptStatus;
  }>> {
    return runQuery(() =>
      prisma.uploadAttempt.findMany({
        where: {
          status: { in: ['READY', 'FAILED', 'CANCEL_REQUESTED', 'CLEANUP_PENDING'] },
          expiresAt: { lt: new Date() },
        },
        select: { id: true, cloudinaryPublicId: true, expectedMediaType: true, status: true },
        take: 100,
      }),
    );
  }

  markCancelled(attemptId: string): Promise<void> {
    return runQuery(async () => {
      await prisma.uploadAttempt.updateMany({
        where: { id: attemptId, status: { in: ['CANCEL_REQUESTED', 'CLEANUP_PENDING'] } },
        data: { status: 'CANCELLED' },
      });
    });
  }
}

export const uploadAttemptRepository = new UploadAttemptRepository();
