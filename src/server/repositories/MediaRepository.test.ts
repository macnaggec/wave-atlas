import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server/repositories/mappers', () => ({
  mapToMediaItem: (row: { id: string; thumbnailUrl?: string; lightboxUrl?: string }) => ({
    id: row.id,
    thumbnailUrl: row.thumbnailUrl,
    lightboxUrl: row.lightboxUrl,
  }),
}));

vi.mock('server/db', () => ({
  prisma: {
    mediaItem: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from 'server/db';
import { MediaRepository } from './MediaRepository';

const repo = new MediaRepository();
const mockFindMany = prisma.mediaItem.findMany as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// findByIdsForFulfillment
// ---------------------------------------------------------------------------

describe('MediaRepository.findByIdsForFulfillment', () => {
  it('passes price: { not: null } to the where clause to exclude unpublished items', async () => {
    mockFindMany.mockResolvedValue([]);

    await repo.findByIdsForFulfillment(['media-1', 'media-2']);

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ price: { not: null } }),
      }),
    );
  });

  it('returns fulfillment items with price as number', async () => {
    mockFindMany.mockResolvedValue([
      { id: 'media-1', price: 1500, photographerId: 'user-1', cloudinaryPublicId: 'wave-atlas/photo-001' },
    ]);

    const result = await repo.findByIdsForFulfillment(['media-1']);

    expect(result).toEqual([
      { id: 'media-1', price: 1500, photographerId: 'user-1', cloudinaryPublicId: 'wave-atlas/photo-001' },
    ]);
  });
});

describe('MediaRepository.findPublishedBySpot', () => {
  function makePrismaMediaItem(overrides: { id?: string; capturedAt?: Date } = {}) {
    return {
      id: overrides.id ?? 'media-1',
      spotId: 'spot-1',
      photographerId: 'user-1',
      type: 'PHOTO',
      status: 'PUBLISHED',
      cloudinaryPublicId: 'test/img',
      thumbnailUrl: 'https://res.cloudinary.com/test/thumb.jpg',
      lightboxUrl: 'https://res.cloudinary.com/test/lbw.jpg',
      capturedAt: overrides.capturedAt ?? new Date('2024-01-01'),
      price: 10,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      deletedAt: null,
      photographer: { id: 'user-1', name: 'Test User' },
    };
  }

  it('returns the last visible item as nextCursor when more exist', async () => {
    const rows = Array.from({ length: 4 }, (_, i) => makePrismaMediaItem({ id: `media-${i}` }));
    mockFindMany.mockResolvedValue(rows);

    const result = await repo.findPublishedBySpot('spot-1', undefined, 3);

    expect(result.items.map((item) => item.id)).toEqual(['media-0', 'media-1', 'media-2']);
    expect(result.nextCursor).toBe('media-2');
  });

  it('returns nextCursor null on last page', async () => {
    const rows = Array.from({ length: 3 }, (_, i) => makePrismaMediaItem({ id: `media-${i}` }));
    mockFindMany.mockResolvedValue(rows);

    const result = await repo.findPublishedBySpot('spot-1', undefined, 3);

    expect(result.items).toHaveLength(3);
    expect(result.nextCursor).toBeNull();
  });

  it('passes cursor and skip:1 to prisma when cursor is provided', async () => {
    mockFindMany.mockResolvedValue([]);

    await repo.findPublishedBySpot('spot-1', 'cursor-id', 3);

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: { id: 'cursor-id' },
        skip: 1,
      }),
    );
  });

  it('queries only PUBLISHED non-deleted items for the given spotId', async () => {
    mockFindMany.mockResolvedValue([]);

    await repo.findPublishedBySpot('spot-42', undefined, 10);

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          spotId: 'spot-42',
          status: 'PUBLISHED',
          deletedAt: null,
        }),
      }),
    );
  });
});

describe('MediaRepository.findDraftsBySpot', () => {
  it('queries only owned non-deleted drafts for the spot', async () => {
    mockFindMany.mockResolvedValue([]);

    await repo.findDraftsBySpot('spot-1', 'user-1');

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          spotId: 'spot-1',
          photographerId: 'user-1',
          status: 'DRAFT',
          deletedAt: null,
        },
        orderBy: { createdAt: 'desc' },
      }),
    );
  });
});
