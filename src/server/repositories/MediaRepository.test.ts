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
