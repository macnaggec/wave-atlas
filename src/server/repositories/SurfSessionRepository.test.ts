import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MediaType } from '@prisma/client';

vi.mock('server/repositories/mappers', () => ({
  mapToMediaItem: (row: { id: string }) => ({ id: row.id }),
}));

vi.mock('server/db', () => ({
  prisma: {
    $transaction: vi.fn(),
    mediaItem: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from 'server/db';
import { SurfSessionRepository } from './SurfSessionRepository';
import { BadRequestError } from 'shared/errors';

const repo = new SurfSessionRepository();
const mockTransaction = prisma.$transaction as ReturnType<typeof vi.fn>;
const mockFindMany = prisma.mediaItem.findMany as ReturnType<typeof vi.fn>;

const BASE_DATA = {
  spotId: 'spot-uuid-1',
  photographerId: 'user-uuid-1',
  startsAt: new Date('2026-01-01T06:00:00Z'),
  endsAt: new Date('2026-01-01T08:00:00Z'),
  mediaItems: [
    { id: 'media-1', type: MediaType.PHOTO },
    { id: 'media-2', type: MediaType.VIDEO },
  ],
  photoPrice: 1000,
  videoPrice: 2000,
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// findPublishableDraftMedia
// ---------------------------------------------------------------------------

describe('SurfSessionRepository.findPublishableDraftMedia', () => {
  it('queries owned undeleted draft media by id', async () => {
    mockFindMany.mockResolvedValue([{ id: 'media-1', type: 'PHOTO' }]);

    const result = await repo.findPublishableDraftMedia('user-1', ['media-1', 'media-2']);

    expect(result).toEqual([{ id: 'media-1', type: 'PHOTO' }]);
    expect(mockFindMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['media-1', 'media-2'] },
        photographerId: 'user-1',
        status: 'DRAFT',
        deletedAt: null,
      },
      select: { id: true, type: true },
    });
  });
});

// ---------------------------------------------------------------------------
// createAndPublish
// ---------------------------------------------------------------------------

describe('SurfSessionRepository.createAndPublish', () => {
  function makeTx() {
    return {
      surfSession: {
        create: vi.fn().mockResolvedValue({ id: 'session-uuid-1' }),
      },
      mediaItem: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      sessionMedia: {
        createMany: vi.fn().mockResolvedValue({ count: 2 }),
      },
    };
  }

  it('creates a session and publishes already-validated media inside one transaction', async () => {
    const tx = makeTx();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockTransaction.mockImplementation((fn: any) => fn(tx));

    const result = await repo.createAndPublish(BASE_DATA);

    expect(result).toEqual({ id: 'session-uuid-1' });
    expect(tx.sessionMedia.createMany).toHaveBeenCalledWith({
      data: [
        { sessionId: 'session-uuid-1', mediaId: 'media-1' },
        { sessionId: 'session-uuid-1', mediaId: 'media-2' },
      ],
    });
    expect(tx.mediaItem.updateMany).toHaveBeenNthCalledWith(1, {
      where: {
        id: { in: ['media-1'] },
        photographerId: 'user-uuid-1',
        status: 'DRAFT',
        deletedAt: null,
      },
      data: { spotId: 'spot-uuid-1', price: 1000, status: 'PUBLISHED' },
    });
    expect(tx.mediaItem.updateMany).toHaveBeenNthCalledWith(2, {
      where: {
        id: { in: ['media-2'] },
        photographerId: 'user-uuid-1',
        status: 'DRAFT',
        deletedAt: null,
      },
      data: { spotId: 'spot-uuid-1', price: 2000, status: 'PUBLISHED' },
    });
  });

  it('throws BadRequestError when constrained media updates miss a validated item', async () => {
    const tx = makeTx();
    tx.mediaItem.updateMany.mockResolvedValueOnce({ count: 0 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockTransaction.mockImplementation((fn: any) => fn(tx));

    await expect(repo.createAndPublish(BASE_DATA)).rejects.toThrow(BadRequestError);
  });
});

// ---------------------------------------------------------------------------
// publish
// ---------------------------------------------------------------------------

describe('SurfSessionRepository.publish', () => {
  function makePublishTx(sessionUpdateCount: number) {
    return {
      surfSession: {
        update: vi.fn().mockResolvedValue({ id: 'session-1' }),
        updateMany: vi.fn().mockResolvedValue({ count: sessionUpdateCount }),
      },
      mediaItem: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findMany: vi.fn().mockResolvedValue([{ id: 'media-1' }]),
      },
    };
  }

  it('publishes only when the session is the photographer-owned draft', async () => {
    const tx = makePublishTx(1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockTransaction.mockImplementation((fn: any) => fn(tx));

    const result = await repo.publish('session-1', 'user-1');

    expect(result).toEqual({ mediaIds: ['media-1'] });
    expect(tx.surfSession.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'session-1',
        photographerId: 'user-1',
        status: 'DRAFT',
      },
      data: { status: 'PUBLISHED' },
    });
    expect(tx.surfSession.update).not.toHaveBeenCalled();
  });

  it('throws BadRequestError when no photographer-owned draft session is updated', async () => {
    const tx = makePublishTx(0);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockTransaction.mockImplementation((fn: any) => fn(tx));

    await expect(repo.publish('session-1', 'user-1')).rejects.toThrow(BadRequestError);
  });
});
