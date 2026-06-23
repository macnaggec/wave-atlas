import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UploadService } from './UploadService';
import type { IUploadAttemptRepository } from 'server/repositories/UploadAttemptRepository';
import type { DirectUploadPort, RemoteImportPort, AssetCleanupPort } from 'server/ports/UploadAssetStorage';
import type { ISurfSessionRepository } from 'server/repositories/SurfSessionRepository';
import { randomUUID } from 'node:crypto';
import { ForbiddenError } from 'shared/errors';

const mockRepo: IUploadAttemptRepository = {
  beginLocalIdempotent: vi.fn(),
  beginDriveIdempotent: vi.fn(),
  markAcquiring: vi.fn(),
  finalizeIntoDraft: vi.fn(),
  cancelAttempt: vi.fn(),
  findByIdForPhotographer: vi.fn(),
  findDriveDetails: vi.fn(),
  listForDraft: vi.fn(),
  hasBlockingAttempts: vi.fn(),
  removeCompletedDraftMedia: vi.fn(),
  findExpiredForReconciliation: vi.fn(),
  markCancelled: vi.fn(),
};

const mockDirect: DirectUploadPort = {
  createUploadGrant: vi.fn(),
  verifyUploadReceipt: vi.fn(),
};

const mockImport: RemoteImportPort = {
  importRemoteFile: vi.fn(),
};

const mockCleanup: AssetCleanupPort = {
  deleteStoredAsset: vi.fn(),
};

const mockSessions: Pick<ISurfSessionRepository, 'findDraftById'> = {
  findDraftById: vi.fn(),
};

const service = new UploadService(mockRepo, mockDirect, mockImport, mockCleanup, mockSessions);

const photographerId = randomUUID();
const sessionId = randomUUID();
const attemptId = randomUUID();

beforeEach(() => vi.clearAllMocks());

describe('beginLocal', () => {
  it('verifies draft ownership before creating an attempt', async () => {
    vi.mocked(mockSessions.findDraftById).mockResolvedValue({
      id: sessionId, photographerId: 'other-user',
    } as never);

    await expect(
      service.beginLocal(photographerId, { draftId: sessionId, clientRequestId: randomUUID(), declaredMimeType: 'image/jpeg', declaredByteSize: 1024 }),
    ).rejects.toThrow();
  });

  it('returns a DirectUploadGrant with the attemptId filled in', async () => {
    const draft = { id: sessionId, photographerId } as never;
    const attempt = { id: attemptId, cloudinaryPublicId: 'test/abc', clientRequestId: 'r1', source: 'LOCAL', status: 'READY', errorCode: null, createdAt: new Date() } as never;
    const grant = { attemptId: '', cloudinaryPublicId: 'test/abc', signature: 'sig', timestamp: 1, cloudName: 'c', apiKey: 'k', type: 'authenticated', eager: 'e', expiresAt: new Date() } as never;

    vi.mocked(mockSessions.findDraftById).mockResolvedValue(draft);
    vi.mocked(mockRepo.beginLocalIdempotent).mockResolvedValue(attempt);
    vi.mocked(mockDirect.createUploadGrant).mockReturnValue(grant);

    const result = await service.beginLocal(photographerId, {
      draftId: sessionId, clientRequestId: 'r1', declaredMimeType: 'image/jpeg', declaredByteSize: 1024,
    });

    expect(result.attemptId).toBe(attemptId);
  });
});

describe('processDrive', () => {
  it('deletes the late asset and does not finalize when attempt is CANCEL_REQUESTED', async () => {
    const attempt = { id: attemptId, photographerId, cloudinaryPublicId: 'test/abc', status: 'CANCEL_REQUESTED', source: 'DRIVE', errorCode: null, createdAt: new Date(), clientRequestId: 'r1' } as never;
    vi.mocked(mockRepo.markAcquiring).mockResolvedValue();
    vi.mocked(mockRepo.findDriveDetails).mockResolvedValue({
      remoteFileId: 'drive-file-1',
      cloudinaryPublicId: 'test/abc',
    });
    vi.mocked(mockImport.importRemoteFile).mockResolvedValue({ cloudinaryPublicId: 'test/abc', resourceType: 'PHOTO', thumbnailUrl: 't', lightboxUrl: 'l' });
    vi.mocked(mockRepo.findByIdForPhotographer).mockResolvedValue(attempt);

    await service.processDrive(photographerId, { attemptId, accessToken: 'token' });

    expect(mockCleanup.deleteStoredAsset).toHaveBeenCalledWith({ cloudinaryPublicId: 'test/abc', resourceType: 'PHOTO' });
    expect(mockRepo.finalizeIntoDraft).not.toHaveBeenCalled();
  });

  it('cancels the attempt and preserves the provider error when import fails', async () => {
    const providerError = new Error('provider down');
    vi.mocked(mockRepo.markAcquiring).mockResolvedValue();
    vi.mocked(mockRepo.findDriveDetails).mockResolvedValue({
      remoteFileId: 'drive-file-1',
      cloudinaryPublicId: 'test/abc',
    });
    vi.mocked(mockImport.importRemoteFile).mockRejectedValue(providerError);
    vi.mocked(mockRepo.cancelAttempt).mockResolvedValue();

    await expect(
      service.processDrive(photographerId, { attemptId, accessToken: 'token' }),
    ).rejects.toBe(providerError);

    expect(mockRepo.cancelAttempt).toHaveBeenCalledWith(attemptId, photographerId);
    expect(mockRepo.finalizeIntoDraft).not.toHaveBeenCalled();
  });
});

describe('discard cleanup', () => {
  it('rejects another photographer\'s draft before removing its media', async () => {
    vi.mocked(mockSessions.findDraftById).mockResolvedValue({
      id: sessionId,
      photographerId: 'other-user',
    } as never);

    await expect(service.discardDraft(photographerId, sessionId)).rejects.toThrow(ForbiddenError);

    expect(mockRepo.removeCompletedDraftMedia).not.toHaveBeenCalled();
  });

  it('keeps authoritative draft cleanup successful when provider cleanup fails', async () => {
    vi.mocked(mockSessions.findDraftById).mockResolvedValue({ id: sessionId, photographerId } as never);
    vi.mocked(mockRepo.removeCompletedDraftMedia).mockResolvedValue([
      { cloudinaryPublicId: 'test/photo', resourceType: 'PHOTO' },
      { cloudinaryPublicId: 'test/video', resourceType: 'VIDEO' },
    ]);
    vi.mocked(mockCleanup.deleteStoredAsset)
      .mockRejectedValueOnce(new Error('provider down'))
      .mockResolvedValueOnce();

    await expect(service.discardDraft(photographerId, sessionId)).resolves.toBeUndefined();

    expect(mockCleanup.deleteStoredAsset).toHaveBeenCalledTimes(2);
    expect(mockCleanup.deleteStoredAsset).toHaveBeenCalledWith({
      cloudinaryPublicId: 'test/photo',
      resourceType: 'PHOTO',
    });
    expect(mockCleanup.deleteStoredAsset).toHaveBeenCalledWith({
      cloudinaryPublicId: 'test/video',
      resourceType: 'VIDEO',
    });
  });

  it('keeps attempt cancellation successful when provider cleanup fails', async () => {
    vi.mocked(mockRepo.cancelAttempt).mockResolvedValue();
    vi.mocked(mockRepo.findByIdForPhotographer).mockResolvedValue({
      id: attemptId,
      cloudinaryPublicId: 'test/photo',
      status: 'CANCEL_REQUESTED',
    } as never);
    vi.mocked(mockCleanup.deleteStoredAsset).mockRejectedValue(new Error('provider down'));

    await expect(service.discardAttempt(photographerId, attemptId)).resolves.toBeUndefined();

    expect(mockRepo.cancelAttempt).toHaveBeenCalledWith(attemptId, photographerId);
    expect(mockCleanup.deleteStoredAsset).toHaveBeenCalledWith({
      cloudinaryPublicId: 'test/photo',
      resourceType: 'PHOTO',
    });
  });
});
