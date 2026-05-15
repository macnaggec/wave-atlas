import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MediaService } from 'server/services/MediaService';
import type { IMediaRepository } from 'server/repositories/MediaRepository';
import type { IMediaImportService } from 'server/services/MediaImportService';
import { BadRequestError } from 'shared/errors';
import { MEDIA_STATUS } from 'entities/Media/constants';
import { MediaImportSource } from '@prisma/client';

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

const mockImporter = {
  importFromRemote: vi.fn(),
  importForDownload: vi.fn(),
  verifyRemoteAvailability: vi.fn(),
};

const service = new MediaService(
  mockMedia as unknown as IMediaRepository,
  mockImporter as unknown as IMediaImportService,
);

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function makeMediaItem(overrides: { price?: number; id?: string; status?: string; importSource?: MediaImportSource; remoteFileId?: string | null } = {}) {
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
    importSource: overrides.importSource ?? MediaImportSource.DIRECT,
    remoteFileId: overrides.remoteFileId ?? null,
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
    mockMedia.findById.mockResolvedValue(makeMediaItem({ price: 0 }));

    await expect(
      service.publish('user-1', ['media-1'], {})
    ).rejects.toThrow(BadRequestError);
  });

  it('throws BadRequestError when item has price 200 cents and no input price is given', async () => {
    mockMedia.findById.mockResolvedValue(makeMediaItem({ price: 200 }));

    await expect(
      service.publish('user-1', ['media-1'], {})
    ).rejects.toThrow(BadRequestError);
  });

  it('succeeds when item already has price >= 300 cents and no input price is given', async () => {
    mockMedia.findById.mockResolvedValue(makeMediaItem({ price: 300 }));
    mockMedia.updateMedia.mockResolvedValue(makeMediaItem({ price: 300, status: MEDIA_STATUS.PUBLISHED }));

    await service.publish('user-1', ['media-1'], {});

    expect(mockMedia.updateMedia).toHaveBeenCalledWith(
      'media-1',
      expect.objectContaining({ status: MEDIA_STATUS.PUBLISHED }),
    );
  });

  it('succeeds when input price overrides the existing 0-price item with >= 300 cents', async () => {
    mockMedia.findById.mockResolvedValue(makeMediaItem({ price: 0 }));
    mockMedia.updateMedia.mockResolvedValue(makeMediaItem({ price: 500, status: MEDIA_STATUS.PUBLISHED }));

    await service.publish('user-1', ['media-1'], { price: 500 });

    expect(mockMedia.updateMedia).toHaveBeenCalledWith(
      'media-1',
      expect.objectContaining({ status: MEDIA_STATUS.PUBLISHED, price: 500 }),
    );
  });

  it('throws BadRequestError when item is already published', async () => {
    mockMedia.findById.mockResolvedValue(makeMediaItem({ price: 500, status: MEDIA_STATUS.PUBLISHED }));

    await expect(
      service.publish('user-1', ['media-1'], {})
    ).rejects.toThrow(BadRequestError);
  });
});

// ---------------------------------------------------------------------------
// publish — GOOGLE_DRIVE branch
// ---------------------------------------------------------------------------

describe('MediaService.publish — GOOGLE_DRIVE branch', () => {
  it('calls importer.importFromRemote with the correct source and remoteFileId', async () => {
    const driveItem = makeMediaItem({
      price: 500,
      status: MEDIA_STATUS.DRIVE_PENDING,
      importSource: MediaImportSource.GOOGLE_DRIVE,
      remoteFileId: 'drive-file-abc',
    });
    mockMedia.findById.mockResolvedValue(driveItem);
    mockImporter.importFromRemote.mockResolvedValue({
      thumbnailUrl: 'https://res.cloudinary.com/t_thumb/img.jpg',
      lightboxUrl: 'https://res.cloudinary.com/t_lbw/img.jpg',
      resourceType: 'image',
    });
    mockMedia.updateMedia.mockResolvedValue({ ...driveItem, status: MEDIA_STATUS.PUBLISHED });

    await service.publish('user-1', ['media-1'], {});

    expect(mockImporter.importFromRemote).toHaveBeenCalledWith(
      MediaImportSource.GOOGLE_DRIVE,
      'drive-file-abc',
      'wave-atlas/users/user-1',
    );
  });

  it('persists the real thumbnailUrl and lightboxUrl returned from Cloudinary', async () => {
    const driveItem = makeMediaItem({
      price: 500,
      status: MEDIA_STATUS.DRIVE_PENDING,
      importSource: MediaImportSource.GOOGLE_DRIVE,
      remoteFileId: 'drive-file-abc',
    });
    mockMedia.findById.mockResolvedValue(driveItem);
    mockImporter.importFromRemote.mockResolvedValue({
      thumbnailUrl: 'https://res.cloudinary.com/t_thumb/real.jpg',
      lightboxUrl: 'https://res.cloudinary.com/t_lbw/real.jpg',
      resourceType: 'image',
    });
    mockMedia.updateMedia.mockResolvedValue({ ...driveItem, status: MEDIA_STATUS.PUBLISHED });

    await service.publish('user-1', ['media-1'], {});

    expect(mockMedia.updateMedia).toHaveBeenCalledWith(
      'media-1',
      expect.objectContaining({
        thumbnailUrl: 'https://res.cloudinary.com/t_thumb/real.jpg',
        lightboxUrl: 'https://res.cloudinary.com/t_lbw/real.jpg',
        status: MEDIA_STATUS.PUBLISHED,
      }),
    );
  });

  it('does NOT call importer.importFromRemote for DIRECT items', async () => {
    mockMedia.findById.mockResolvedValue(makeMediaItem({ price: 500 }));
    mockMedia.updateMedia.mockResolvedValue(makeMediaItem({ price: 500, status: MEDIA_STATUS.PUBLISHED }));

    await service.publish('user-1', ['media-1'], {});

    expect(mockImporter.importFromRemote).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// registerDriveImport
// ---------------------------------------------------------------------------

describe('MediaService.registerDriveImport', () => {
  const BASE_INPUT = {
    spotId: 'spot-1',
    remoteFileId: 'drive-file-xyz',
    mimeType: 'image/jpeg',
    driveThumbnailUrl: 'https://lh3.googleusercontent.com/thumb.jpg',
  };

  it('creates a DRIVE_PENDING item with GOOGLE_DRIVE importSource and empty cloudinaryPublicId', async () => {
    mockMedia.createMedia.mockResolvedValue({});

    await service.registerDriveImport('user-1', BASE_INPUT);

    expect(mockMedia.createMedia).toHaveBeenCalledWith(
      expect.objectContaining({
        status: MEDIA_STATUS.DRIVE_PENDING,
        importSource: MediaImportSource.GOOGLE_DRIVE,
        remoteFileId: 'drive-file-xyz',
        cloudinaryPublicId: '',
      }),
    );
  });

  it('sets type to VIDEO when mimeType starts with video/', async () => {
    mockMedia.createMedia.mockResolvedValue({});

    await service.registerDriveImport('user-1', { ...BASE_INPUT, mimeType: 'video/mp4' });

    expect(mockMedia.createMedia).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'VIDEO' }),
    );
  });

  it('sets type to PHOTO for non-video mimeTypes', async () => {
    mockMedia.createMedia.mockResolvedValue({});

    await service.registerDriveImport('user-1', { ...BASE_INPUT, mimeType: 'image/jpeg' });

    expect(mockMedia.createMedia).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'PHOTO' }),
    );
  });
});

// ---------------------------------------------------------------------------
// deleteMedia
// ---------------------------------------------------------------------------

describe('MediaService.deleteMedia', () => {
  it('hard-deletes a DRIVE_PENDING item (no Cloudinary asset to clean up)', async () => {
    mockMedia.findById.mockResolvedValue(
      makeMediaItem({ status: MEDIA_STATUS.DRIVE_PENDING }),
    );

    await service.deleteMedia('user-1', 'media-1');

    expect(mockMedia.hardDelete).toHaveBeenCalledWith('media-1');
    expect(mockMedia.softDelete).not.toHaveBeenCalled();
  });

  it('hard-deletes a DRAFT item', async () => {
    mockMedia.findById.mockResolvedValue(makeMediaItem({ status: MEDIA_STATUS.DRAFT }));

    await service.deleteMedia('user-1', 'media-1');

    expect(mockMedia.hardDelete).toHaveBeenCalledWith('media-1');
    expect(mockMedia.softDelete).not.toHaveBeenCalled();
  });

  it('soft-deletes a PUBLISHED item', async () => {
    mockMedia.findById.mockResolvedValue(makeMediaItem({ status: MEDIA_STATUS.PUBLISHED, price: 500 }));

    await service.deleteMedia('user-1', 'media-1');

    expect(mockMedia.softDelete).toHaveBeenCalledWith('media-1');
    expect(mockMedia.hardDelete).not.toHaveBeenCalled();
  });
});
