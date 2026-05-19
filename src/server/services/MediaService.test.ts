import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MediaService } from 'server/services/MediaService';
import type { IMediaRepository } from 'server/repositories/MediaRepository';
import type { ICloudinaryService } from 'server/services/CloudinaryService';
import { BadRequestError } from 'shared/errors';
import { MEDIA_STATUS, MIN_MEDIA_PRICE_CENTS } from 'entities/Media/constants';

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

const mockCloudinary = {
  generateUploadSignature: vi.fn(),
  uploadFromUrl: vi.fn(),
  deleteAsset: vi.fn(),
} as unknown as ICloudinaryService;

const service = new MediaService(mockMedia as unknown as IMediaRepository, mockCloudinary);

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
// Factories
// ---------------------------------------------------------------------------

const driveInput = {
  spotId: 'spot-1',
  remoteFileId: 'drive-file-abc123',
  mimeType: 'image/jpeg',
  accessToken: 'ya29.token',
};

const cloudinaryResult = {
  publicId: 'wave-atlas/users/user-1/img',
  resource_type: 'image',
  thumbnailUrl: 'https://res.cloudinary.com/test/t_thumb/img.jpg',
  lightboxUrl: 'https://res.cloudinary.com/test/t_lbw/img.jpg',
};

// ---------------------------------------------------------------------------
// registerDriveImport
// ---------------------------------------------------------------------------

describe('MediaService.registerDriveImport', () => {
  it('happy path: returns MediaItem when Cloudinary upload and DB write both succeed', async () => {
    const draft = makeDraft();
    vi.mocked(mockCloudinary.uploadFromUrl).mockResolvedValue(cloudinaryResult);
    mockMedia.createMedia.mockResolvedValue(draft);

    const result = await service.registerDriveImport('user-1', driveInput);

    expect(result).toBe(draft);
    expect(mockCloudinary.uploadFromUrl).toHaveBeenCalledWith(
      `https://www.googleapis.com/drive/v3/files/${driveInput.remoteFileId}?alt=media`,
      { Authorization: `Bearer ${driveInput.accessToken}` },
      'wave-atlas/users/user-1',
      'image',
    );
    expect(mockMedia.createMedia).toHaveBeenCalledWith(expect.objectContaining({
      spotId: driveInput.spotId,
      photographerId: 'user-1',
      cloudinaryPublicId: cloudinaryResult.publicId,
      thumbnailUrl: cloudinaryResult.thumbnailUrl,
      lightboxUrl: cloudinaryResult.lightboxUrl,
      price: MIN_MEDIA_PRICE_CENTS,
      status: MEDIA_STATUS.DRAFT,
    }));
    expect(mockCloudinary.deleteAsset).not.toHaveBeenCalled();
  });

  it('Cloudinary failure: does not call createMedia or deleteAsset', async () => {
    vi.mocked(mockCloudinary.uploadFromUrl).mockRejectedValue(new Error('Cloudinary error'));

    await expect(service.registerDriveImport('user-1', driveInput)).rejects.toThrow('Cloudinary error');

    expect(mockMedia.createMedia).not.toHaveBeenCalled();
    expect(mockCloudinary.deleteAsset).not.toHaveBeenCalled();
  });

  it('DB failure after Cloudinary upload: calls deleteAsset with the correct publicId and re-throws', async () => {
    const dbError = new Error('DB write failed');
    vi.mocked(mockCloudinary.uploadFromUrl).mockResolvedValue(cloudinaryResult);
    mockMedia.createMedia.mockRejectedValue(dbError);
    vi.mocked(mockCloudinary.deleteAsset).mockResolvedValue(undefined);

    await expect(service.registerDriveImport('user-1', driveInput)).rejects.toThrow(dbError);

    // Give the fire-and-forget cleanup a tick to run
    await new Promise((r) => setTimeout(r, 0));

    expect(mockCloudinary.deleteAsset).toHaveBeenCalledWith(
      cloudinaryResult.publicId,
      cloudinaryResult.resource_type,
    );
  });
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
