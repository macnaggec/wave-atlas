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
  createMedia: vi.fn(),
  updateMedia: vi.fn(),
  updateManyMedia: vi.fn(),
  hardDelete: vi.fn(),
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

const service = new MediaService(mockMedia as unknown as IMediaRepository, mockCloudinary);

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function makeBatchItem(overrides: { price?: number | null; id?: string; status?: string } = {}) {
  return {
    id: overrides.id ?? 'media-1',
    photographerId: 'user-1',
    status: overrides.status ?? MEDIA_STATUS.DRAFT,
    price: overrides.price !== undefined ? overrides.price : 0,
  };
}

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
// publish — price guard
// ---------------------------------------------------------------------------

describe('MediaService.publish — price guard', () => {
  it('throws BadRequestError when item has price 0 and no input price is given', async () => {
    mockMedia.findByIds.mockResolvedValue([makeBatchItem({ price: 0 })]);

    await expect(
      service.publish('user-1', ['media-1'], {})
    ).rejects.toThrow(BadRequestError);
  });

  it('throws BadRequestError when item has price 200 cents and no input price is given', async () => {
    mockMedia.findByIds.mockResolvedValue([makeBatchItem({ price: 200 })]);

    await expect(
      service.publish('user-1', ['media-1'], {})
    ).rejects.toThrow(BadRequestError);
  });

  it('succeeds when item already has price >= 300 cents and no input price is given', async () => {
    mockMedia.findByIds.mockResolvedValue([makeBatchItem({ price: 300 })]);

    await expect(
      service.publish('user-1', ['media-1'], {})
    ).resolves.not.toThrow();
  });

  it('succeeds when input price overrides the existing 0-price item with >= 300 cents', async () => {
    mockMedia.findByIds.mockResolvedValue([makeBatchItem({ price: 0 })]);

    await expect(
      service.publish('user-1', ['media-1'], { price: 500 })
    ).resolves.not.toThrow();
  });

  it('throws BadRequestError when item is already published', async () => {
    mockMedia.findByIds.mockResolvedValue([makeBatchItem({ price: 500, status: MEDIA_STATUS.PUBLISHED })]);

    await expect(
      service.publish('user-1', ['media-1'], {})
    ).rejects.toThrow(BadRequestError);
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
