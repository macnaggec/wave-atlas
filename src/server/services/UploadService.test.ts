import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UploadService } from './UploadService';
import type { IUploadAttemptRepository } from 'server/repositories/UploadAttemptRepository';
import type { DirectUploadPort, RemoteImportPort, AssetCleanupPort } from 'server/ports/UploadAssetStorage';
import type { ISurfSessionRepository } from 'server/repositories/SurfSessionRepository';
import { randomUUID } from 'node:crypto';

const mockRepo: IUploadAttemptRepository = {
  beginLocalIdempotent: vi.fn(),
  beginDriveIdempotent: vi.fn(),
  markAcquiring: vi.fn(),
  finalizeIntoDraft: vi.fn(),
  cancelAttempt: vi.fn(),
  findByIdForPhotographer: vi.fn(),
  listForDraft: vi.fn(),
  hasBlockingAttempts: vi.fn(),
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
    vi.mocked(mockImport.importRemoteFile).mockResolvedValue({ cloudinaryPublicId: 'test/abc', resourceType: 'PHOTO', thumbnailUrl: 't', lightboxUrl: 'l' });
    vi.mocked(mockRepo.findByIdForPhotographer).mockResolvedValue(attempt);

    await service.processDrive(photographerId, { attemptId, accessToken: 'token' });

    expect(mockCleanup.deleteStoredAsset).toHaveBeenCalledWith({ cloudinaryPublicId: 'test/abc', resourceType: 'PHOTO' });
    expect(mockRepo.finalizeIntoDraft).not.toHaveBeenCalled();
  });
});
