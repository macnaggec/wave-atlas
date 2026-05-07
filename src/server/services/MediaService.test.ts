import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MediaService } from 'server/services/MediaService';
import type { IMediaRepository } from 'server/repositories/MediaRepository';
import { BadRequestError } from 'shared/errors';
import { MEDIA_STATUS } from 'entities/Media/constants';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockMedia = {
  findById: vi.fn(),
  createMedia: vi.fn(),
  updateMedia: vi.fn(),
  hardDelete: vi.fn(),
  softDelete: vi.fn(),
  findDraftsBySpot: vi.fn(),
  findByIds: vi.fn(),
};

const service = new MediaService(mockMedia as unknown as IMediaRepository);

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function makeDraft(overrides: { price?: number; id?: string; status?: string } = {}) {
  return {
    id: overrides.id ?? 'media-1',
    photographerId: 'user-1',
    status: overrides.status ?? MEDIA_STATUS.DRAFT,
    price: overrides.price ?? 0,
    spotId: 'spot-1',
    thumbnailUrl: 'https://res.cloudinary.com/test/t_thumb/img.jpg',
    lightboxUrl: 'https://res.cloudinary.com/test/t_lbw/img.jpg',
    capturedAt: new Date(),
    type: 'IMAGE',
    cloudinaryPublicId: 'wave-atlas/img',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// publish — price guard
// ---------------------------------------------------------------------------

describe('MediaService.publish — price guard', () => {
  it('throws BadRequestError when item has price 0 and no input price is given', async () => {
    mockMedia.findById.mockResolvedValue(makeDraft({ price: 0 }));

    await expect(
      service.publish('user-1', ['media-1'], {})
    ).rejects.toThrow(BadRequestError);
  });

  it('throws BadRequestError when item has price 200 cents and no input price is given', async () => {
    mockMedia.findById.mockResolvedValue(makeDraft({ price: 200 }));

    await expect(
      service.publish('user-1', ['media-1'], {})
    ).rejects.toThrow(BadRequestError);
  });

  it('succeeds when item already has price >= 300 cents and no input price is given', async () => {
    mockMedia.findById.mockResolvedValue(makeDraft({ price: 300 }));
    mockMedia.updateMedia.mockResolvedValue(makeDraft({ price: 300 }));

    await expect(
      service.publish('user-1', ['media-1'], {})
    ).resolves.not.toThrow();
  });

  it('succeeds when input price overrides the existing 0-price item with >= 300 cents', async () => {
    mockMedia.findById.mockResolvedValue(makeDraft({ price: 0 }));
    mockMedia.updateMedia.mockResolvedValue(makeDraft({ price: 500 }));

    await expect(
      service.publish('user-1', ['media-1'], { price: 500 })
    ).resolves.not.toThrow();
  });

  it('throws BadRequestError when item is already published', async () => {
    mockMedia.findById.mockResolvedValue(makeDraft({ price: 500, status: MEDIA_STATUS.PUBLISHED }));

    await expect(
      service.publish('user-1', ['media-1'], {})
    ).rejects.toThrow(BadRequestError);
  });
});
