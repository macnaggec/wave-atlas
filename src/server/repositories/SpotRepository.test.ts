import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server/repositories/mappers', () => ({
  mapToMediaItem: (row: { id: string }) => ({
    id: row.id,
    thumbnailUrl: `https://test.cloudinary.com/${row.id}/thumb`,
    lightboxUrl: `https://test.cloudinary.com/${row.id}/lbw`,
  }),
}));

vi.mock('server/db', () => ({
  prisma: {
    mediaItem: {
      findMany: vi.fn(),
    },
    spot: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from 'server/db';
import { SpotRepository } from './SpotRepository';

const repo = new SpotRepository();
const mockMediaFindMany = prisma.mediaItem.findMany as ReturnType<typeof vi.fn>;
const mockSpotFindMany = prisma.spot.findMany as ReturnType<typeof vi.fn>;

// Keep old alias for existing tests
const mockFindMany = mockMediaFindMany;

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

beforeEach(() => vi.clearAllMocks());

describe('SpotRepository.findPublishedBySpot', () => {
  it('returns first page of items with nextCursor when more exist', async () => {
    // limit=3, but DB returns 4 (limit+1) — there is a next page
    const rows = Array.from({ length: 4 }, (_, i) => makePrismaMediaItem({ id: `media-${i}` }));
    mockFindMany.mockResolvedValue(rows);

    const result = await repo.findPublishedBySpot('spot-1', undefined, 3);

    expect(result.items).toHaveLength(3);
    expect(result.nextCursor).toBe('media-3');
  });

  it('returns nextCursor null on last page', async () => {
    // DB returns exactly limit items — no next page
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

  it('does not pass cursor when undefined', async () => {
    mockFindMany.mockResolvedValue([]);

    await repo.findPublishedBySpot('spot-1', undefined, 3);

    const call = mockFindMany.mock.calls[0]![0]!;
    expect(call.cursor).toBeUndefined();
    expect(call.skip).toBeUndefined();
  });

  it('returns empty items and null nextCursor for spot with no media', async () => {
    mockFindMany.mockResolvedValue([]);

    const result = await repo.findPublishedBySpot('spot-1', undefined, 30);

    expect(result.items).toEqual([]);
    expect(result.nextCursor).toBeNull();
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

describe('SpotRepository.findSpotsByBounds', () => {
  function makePrismaSpot(overrides: { id?: string; lat?: string; lng?: string } = {}) {
    return {
      id: overrides.id ?? 'spot-1',
      name: 'Test Spot',
      location: 'Bali, Indonesia',
      lat: overrides.lat ?? '10.0',
      lng: overrides.lng ?? '115.0',
      status: 'verified',
      creatorId: null,
      createdAt: new Date('2024-01-01'),
      aliases: [],
      cover_url: null,
      searchRadius: null,
    };
  }

  it('returns mapped spots within the given bounds', async () => {
    const rows = [makePrismaSpot({ id: 'spot-1' }), makePrismaSpot({ id: 'spot-2' })];
    mockSpotFindMany.mockResolvedValue(rows);

    const result = await repo.findSpotsByBounds(-10, 100, 20, 130);

    expect(result).toHaveLength(2);
    expect(result[0]!.id).toBe('spot-1');
    expect(result[1]!.id).toBe('spot-2');
  });

  it('passes the correct bounds filter to prisma', async () => {
    mockSpotFindMany.mockResolvedValue([]);

    await repo.findSpotsByBounds(-10, 100, 20, 130);

    expect(mockSpotFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            { lat: { not: null } },
            { lng: { not: null } },
            { lat: { gte: -10, lte: 20 } },
            { lng: { gte: 100, lte: 130 } },
          ],
        },
        orderBy: { name: 'asc' },
      }),
    );
  });

  it('returns empty array when no spots fall within bounds', async () => {
    mockSpotFindMany.mockResolvedValue([]);

    const result = await repo.findSpotsByBounds(0, 0, 1, 1);

    expect(result).toEqual([]);
  });

  it('maps coords to Position with lat/lng as numbers', async () => {
    mockSpotFindMany.mockResolvedValue([makePrismaSpot({ lat: '-8.815', lng: '115.085' })]);

    const result = await repo.findSpotsByBounds(-90, -180, 90, 180);

    expect(result[0]!.coords).toEqual({ lat: -8.815, lng: 115.085 });
  });
});
