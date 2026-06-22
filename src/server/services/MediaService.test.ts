import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MediaService } from 'server/services/MediaService';
import type { IMediaRepository } from 'server/repositories/MediaRepository';
import { BadRequestError, ForbiddenError } from 'shared/errors';
import { MEDIA_STATUS } from 'shared/types/media';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockMedia = {
  findById: vi.fn(),
  updateMedia: vi.fn(),
  updateManyMedia: vi.fn(),
  softDelete: vi.fn(),
  findDraftsBySpot: vi.fn(),
  findByIds: vi.fn(),
  findByCloudinaryPublicId: vi.fn(),
  findPublishedByPhotographer: vi.fn(),
  findPublishedBySession: vi.fn(),
};

const mockCloudinary = {
  uploadFromUrl: vi.fn(),
  deleteAsset: vi.fn(),
  generateUploadSignature: vi.fn(),
};

const mockSessions = {
  createDraftMedia: vi.fn(),
  removeDraftMedia: vi.fn(),
  removeDraftMediaBatch: vi.fn(),
};

const service = new (MediaService as unknown as new (
  media: IMediaRepository,
  cloudinary: typeof mockCloudinary,
  sessions: typeof mockSessions,
) => MediaService)(mockMedia as unknown as IMediaRepository, mockCloudinary, mockSessions);

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// findPublishedByPhotographer / findPublishedBySession — delegation
// ---------------------------------------------------------------------------

describe('MediaService.findPublishedByPhotographer', () => {
  it('delegates to the repository with the given photographerId', async () => {
    const items = [{ id: 'media-1' }];
    mockMedia.findPublishedByPhotographer.mockResolvedValue(items);

    const result = await service.findPublishedByPhotographer('user-1');

    expect(mockMedia.findPublishedByPhotographer).toHaveBeenCalledWith('user-1');
    expect(result).toBe(items);
  });
});

describe('MediaService.findPublishedBySession', () => {
  it('delegates to the repository with the given sessionId', async () => {
    const items = [{ id: 'media-2' }];
    mockMedia.findPublishedBySession.mockResolvedValue(items);

    const result = await service.findPublishedBySession('session-1');

    expect(mockMedia.findPublishedBySession).toHaveBeenCalledWith('session-1');
    expect(result).toBe(items);
  });
});

// ---------------------------------------------------------------------------
// updateMedia — price guard
// ---------------------------------------------------------------------------

describe('MediaService.updateMedia — price guard', () => {
  it('throws BadRequestError when updating published media below the price floor', async () => {
    mockMedia.findById.mockResolvedValue({
      id: 'media-1',
      photographerId: 'user-1',
      status: MEDIA_STATUS.PUBLISHED,
    });

    await expect(
      service.updateMedia('user-1', 'media-1', { price: 299 })
    ).rejects.toThrow(BadRequestError);

    expect(mockMedia.updateMedia).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// deleteOrphanAsset
// ---------------------------------------------------------------------------

describe('MediaService.deleteOrphanAsset', () => {
  it('returns without deleting when a live DB record owned by the caller exists', async () => {
    mockMedia.findByCloudinaryPublicId.mockResolvedValue({ id: 'media-1', photographerId: 'user-1' });

    await service.deleteOrphanAsset('user-1', 'wave-atlas/users/user-1/img', 'image');

    expect(mockCloudinary.deleteAsset).not.toHaveBeenCalled();
  });

  it('throws ForbiddenError when a live DB record is owned by a different user', async () => {
    mockMedia.findByCloudinaryPublicId.mockResolvedValue({ id: 'media-1', photographerId: 'other-user' });

    await expect(
      service.deleteOrphanAsset('user-1', 'wave-atlas/users/other-user/img', 'image')
    ).rejects.toThrow(ForbiddenError);

    expect(mockCloudinary.deleteAsset).not.toHaveBeenCalled();
  });

  it('deletes the Cloudinary asset when the publicId is an orphan with the correct prefix', async () => {
    mockMedia.findByCloudinaryPublicId.mockResolvedValue(null);

    await service.deleteOrphanAsset('user-1', 'wave-atlas/users/user-1/img', 'image');

    expect(mockCloudinary.deleteAsset).toHaveBeenCalledWith('wave-atlas/users/user-1/img', 'image');
  });

  it('throws ForbiddenError when publicId contains a path traversal (..)', async () => {
    mockMedia.findByCloudinaryPublicId.mockResolvedValue(null);

    await expect(
      service.deleteOrphanAsset('user-1', 'wave-atlas/users/user-1/../admin/secret', 'image')
    ).rejects.toThrow(ForbiddenError);

    expect(mockCloudinary.deleteAsset).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// deleteMedia — cleanup semantics
// ---------------------------------------------------------------------------

describe('MediaService.deleteMedia — cleanup semantics', () => {
  const draftMedia = {
    id: 'media-1',
    sessionId: 'session-1',
    photographerId: 'user-1',
    cloudinaryPublicId: 'wave-atlas/users/user-1/photo',
    status: MEDIA_STATUS.DRAFT,
    resource: { resourceType: 'image' as const },
  };

  it('removes the DB row then attempts Cloudinary cleanup', async () => {
    mockMedia.findById.mockResolvedValue(draftMedia);
    mockSessions.removeDraftMedia.mockResolvedValue(undefined);
    mockCloudinary.deleteAsset.mockResolvedValue(undefined);

    await service.deleteMedia('user-1', 'media-1');

    expect(mockSessions.removeDraftMedia).toHaveBeenCalledWith('session-1', 'user-1', 'media-1');
    expect(mockCloudinary.deleteAsset).toHaveBeenCalledWith('wave-atlas/users/user-1/photo', 'image');
  });

  it('does not propagate Cloudinary cleanup failure (best-effort)', async () => {
    mockMedia.findById.mockResolvedValue(draftMedia);
    mockSessions.removeDraftMedia.mockResolvedValue(undefined);
    mockCloudinary.deleteAsset.mockRejectedValue(new Error('provider down'));

    await expect(service.deleteMedia('user-1', 'media-1')).resolves.toBeUndefined();
  });

  it('soft-deletes published media without Cloudinary cleanup', async () => {
    mockMedia.findById.mockResolvedValue({ ...draftMedia, status: MEDIA_STATUS.PUBLISHED });
    mockMedia.softDelete.mockResolvedValue(undefined);

    await service.deleteMedia('user-1', 'media-1');

    expect(mockMedia.softDelete).toHaveBeenCalledWith('media-1');
    expect(mockSessions.removeDraftMedia).not.toHaveBeenCalled();
    expect(mockCloudinary.deleteAsset).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// deleteMediaBatch — cleanup semantics
// ---------------------------------------------------------------------------

describe('MediaService.deleteMediaBatch — cleanup semantics', () => {
  const draftItems = [
    { id: 'media-1', sessionId: 'session-1', photographerId: 'user-1', cloudinaryPublicId: 'pub-1', status: MEDIA_STATUS.DRAFT, type: 'IMAGE', price: null },
    { id: 'media-2', sessionId: 'session-1', photographerId: 'user-1', cloudinaryPublicId: 'pub-2', status: MEDIA_STATUS.DRAFT, type: 'VIDEO', price: null },
  ];

  it('removes DB rows then attempts Cloudinary cleanup for each item', async () => {
    mockMedia.findByIds.mockResolvedValue(draftItems);
    mockSessions.removeDraftMediaBatch.mockResolvedValue(undefined);
    mockCloudinary.deleteAsset.mockResolvedValue(undefined);

    await service.deleteMediaBatch('user-1', ['media-1', 'media-2']);

    expect(mockSessions.removeDraftMediaBatch).toHaveBeenCalledWith('session-1', 'user-1', ['media-1', 'media-2']);
    expect(mockCloudinary.deleteAsset).toHaveBeenCalledWith('pub-1', 'image');
    expect(mockCloudinary.deleteAsset).toHaveBeenCalledWith('pub-2', 'video');
  });

  it('does not propagate Cloudinary cleanup failure for any item (best-effort)', async () => {
    mockMedia.findByIds.mockResolvedValue(draftItems);
    mockSessions.removeDraftMediaBatch.mockResolvedValue(undefined);
    mockCloudinary.deleteAsset.mockRejectedValue(new Error('provider down'));

    await expect(service.deleteMediaBatch('user-1', ['media-1', 'media-2'])).resolves.toBeUndefined();
  });

  it('throws BadRequestError when any item is not a draft', async () => {
    mockMedia.findByIds.mockResolvedValue([{ ...draftItems[0]!, status: MEDIA_STATUS.PUBLISHED }]);

    await expect(service.deleteMediaBatch('user-1', ['media-1'])).rejects.toThrow(BadRequestError);
    expect(mockSessions.removeDraftMediaBatch).not.toHaveBeenCalled();
  });

  it('throws BadRequestError when items span multiple sessions', async () => {
    mockMedia.findByIds.mockResolvedValue([
      { ...draftItems[0]!, sessionId: 'session-1' },
      { ...draftItems[1]!, sessionId: 'session-2' },
    ]);

    await expect(service.deleteMediaBatch('user-1', ['media-1', 'media-2'])).rejects.toThrow(BadRequestError);
    expect(mockSessions.removeDraftMediaBatch).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// registerDriveImport — Drive rollback semantics
// ---------------------------------------------------------------------------

describe('MediaService.registerDriveImport — Drive rollback semantics', () => {
  const uploadResult = {
    publicId: 'wave-atlas/users/user-1/drive-file',
    resourceType: 'image' as const,
    thumbnailUrl: 'https://res.cloudinary.com/thumb',
    lightboxUrl: 'https://res.cloudinary.com/lb',
  };

  it('attempts Cloudinary cleanup and re-throws the error when DB creation fails', async () => {
    mockCloudinary.uploadFromUrl.mockResolvedValue(uploadResult);
    mockSessions.createDraftMedia.mockRejectedValue(new Error('DB constraint failure'));
    mockCloudinary.deleteAsset.mockResolvedValue(undefined);

    await expect(
      service.registerDriveImport('user-1', {
        draftId: 'session-1',
        remoteFileId: 'drive-file-123',
        mimeType: 'image/jpeg',
        accessToken: 'token-123',
      })
    ).rejects.toThrow('DB constraint failure');

    expect(mockCloudinary.deleteAsset).toHaveBeenCalledWith(uploadResult.publicId, uploadResult.resourceType);
  });

  it('does not suppress the original DB error when Cloudinary cleanup also fails (best-effort)', async () => {
    mockCloudinary.uploadFromUrl.mockResolvedValue(uploadResult);
    mockSessions.createDraftMedia.mockRejectedValue(new Error('DB failure'));
    mockCloudinary.deleteAsset.mockRejectedValue(new Error('Cloudinary also down'));

    await expect(
      service.registerDriveImport('user-1', {
        draftId: 'session-1',
        remoteFileId: 'drive-file-123',
        mimeType: 'image/jpeg',
        accessToken: 'token-123',
      })
    ).rejects.toThrow('DB failure');
  });
});
