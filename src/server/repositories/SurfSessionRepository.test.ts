import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server/repositories/mappers', () => ({
  mapToMediaItem: (row: { id: string }) => ({ id: row.id }),
}));

vi.mock('server/db', () => ({
  prisma: {
    $transaction: vi.fn(),
    mediaItem: {
      findMany: vi.fn(),
    },
    surfSession: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

import { prisma } from 'server/db';
import { SurfSessionRepository } from './SurfSessionRepository';
import { BadRequestError } from 'shared/errors';

const repo = new SurfSessionRepository();
const mockTransaction = prisma.$transaction as ReturnType<typeof vi.fn>;
const mockSessionUpdateMany = prisma.surfSession.updateMany as ReturnType<typeof vi.fn>;
const mockSessionFindFirst = prisma.surfSession.findFirst as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('SurfSessionRepository.updateDraft', () => {
  it('updates only the photographer-owned draft session', async () => {
    mockSessionUpdateMany.mockResolvedValue({ count: 1 });

    const updateDraft = () => (repo as unknown as {
      updateDraft: (
        sessionId: string,
        photographerId: string,
        data: { spotId: string; photoPrice: number },
      ) => Promise<{ id: string }>;
    }).updateDraft('session-1', 'user-1', { spotId: 'spot-1', photoPrice: 500 });

    await expect(Promise.resolve().then(updateDraft)).resolves.toEqual({ id: 'session-1' });
    expect(mockSessionUpdateMany).toHaveBeenCalledWith({
      where: { id: 'session-1', photographerId: 'user-1', status: 'DRAFT' },
      data: { spotId: 'spot-1', photoPrice: 500 },
    });
  });
});

describe('SurfSessionRepository.findLatestDraftByPhotographer', () => {
  it('selects the photographer\'s most recently updated draft', async () => {
    mockSessionFindFirst.mockResolvedValue(null);

    const findLatestDraft = () => (repo as unknown as {
      findLatestDraftByPhotographer: (photographerId: string) => Promise<unknown>;
    }).findLatestDraftByPhotographer('user-1');

    await expect(Promise.resolve().then(findLatestDraft)).resolves.toBeNull();
    expect(mockSessionFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { photographerId: 'user-1', status: 'DRAFT' },
      orderBy: { updatedAt: 'desc' },
    }));
  });
});

// ---------------------------------------------------------------------------
// publish
// ---------------------------------------------------------------------------

describe('SurfSessionRepository.publish', () => {
  function makePublishTx(sessionUpdateCount: number) {
    return {
      surfSession: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'session-1',
          spotId: 'spot-1',
          startsAt: new Date('2026-01-01T06:00:00Z'),
          endsAt: new Date('2026-01-01T08:00:00Z'),
          photoPrice: 300,
          videoPrice: 500,
          mediaItems: [
            { id: 'media-photo', type: 'PHOTO', photographerId: 'user-1', status: 'DRAFT', deletedAt: null },
            { id: 'media-video', type: 'VIDEO', photographerId: 'user-1', status: 'DRAFT', deletedAt: null },
          ],
        }),
        updateMany: vi.fn().mockResolvedValue({ count: sessionUpdateCount }),
      },
      mediaItem: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
  }

  it('publishes only when the session is the photographer-owned draft', async () => {
    const tx = makePublishTx(1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockTransaction.mockImplementation((fn: any) => fn(tx));

    const result = await repo.publish('session-1', 'user-1');

    expect(result).toEqual({ mediaIds: ['media-photo', 'media-video'] });
    expect(tx.surfSession.findFirst).toHaveBeenCalledWith({
      where: { id: 'session-1', photographerId: 'user-1', status: 'DRAFT' },
      select: {
        id: true,
        spotId: true,
        startsAt: true,
        endsAt: true,
        photoPrice: true,
        videoPrice: true,
        mediaItems: {
          select: { id: true, type: true, photographerId: true, status: true, deletedAt: true },
        },
      },
    });
    expect(tx.surfSession.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'session-1',
        photographerId: 'user-1',
        status: 'DRAFT',
      },
      data: { status: 'PUBLISHED' },
    });
    expect(tx.mediaItem.updateMany).toHaveBeenNthCalledWith(1, {
      where: {
        id: { in: ['media-photo'] },
        sessionId: 'session-1',
        photographerId: 'user-1',
        status: 'DRAFT',
        deletedAt: null,
      },
      data: { spotId: 'spot-1', price: 300, status: 'PUBLISHED' },
    });
    expect(tx.mediaItem.updateMany).toHaveBeenNthCalledWith(2, {
      where: {
        id: { in: ['media-video'] },
        sessionId: 'session-1',
        photographerId: 'user-1',
        status: 'DRAFT',
        deletedAt: null,
      },
      data: { spotId: 'spot-1', price: 500, status: 'PUBLISHED' },
    });
  });

  it('throws BadRequestError when no photographer-owned draft session is updated', async () => {
    const tx = makePublishTx(0);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockTransaction.mockImplementation((fn: any) => fn(tx));

    await expect(repo.publish('session-1', 'user-1')).rejects.toThrow(BadRequestError);
  });

  it('rejects an invalid persisted time window before publishing media', async () => {
    const tx = makePublishTx(1);
    tx.surfSession.findFirst.mockResolvedValue({
      id: 'session-1',
      spotId: 'spot-1',
      startsAt: new Date('2026-01-01T09:00:00Z'),
      endsAt: new Date('2026-01-01T08:00:00Z'),
      photoPrice: 300,
      videoPrice: 500,
      mediaItems: [
        { id: 'media-photo', type: 'PHOTO', photographerId: 'user-1', status: 'DRAFT', deletedAt: null },
      ],
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockTransaction.mockImplementation((fn: any) => fn(tx));

    await expect(repo.publish('session-1', 'user-1')).rejects.toThrow(BadRequestError);

    expect(tx.mediaItem.updateMany).not.toHaveBeenCalled();
    expect(tx.surfSession.updateMany).not.toHaveBeenCalled();
  });
});
