import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePublishUploadSession } from './usePublishUploadSession';
import type { GalleryCard } from './types';
import type { MediaItem } from 'entities/Media';

const mocks = vi.hoisted(() => ({
  clearQueue: vi.fn(),
  createAndPublish: vi.fn(),
  invalidateQueries: vi.fn(),
  notifyError: vi.fn(),
}));

vi.mock('entities/SurfSession', () => ({
  usePublishSession: () => ({
    mutateAsync: mocks.createAndPublish,
    isPending: false,
  }),
}));

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
  };
});

vi.mock('shared/lib/trpc', () => ({
  useTRPC: () => ({
    users: {
      myDraftCounts: { queryKey: () => ['users', 'myDraftCounts'] },
      myUploads: { queryKey: () => ['users', 'myUploads'] },
    },
    media: {
      myDrafts: { queryKey: () => ['media', 'myDrafts'] },
    },
  }),
}));

vi.mock('shared/lib/notifications', () => ({
  notify: {
    error: mocks.notifyError,
  },
}));

vi.mock('./useClearUploadQueue', () => ({
  useClearUploadQueue: () => mocks.clearQueue,
}));

describe('usePublishUploadSession', () => {
  const startsDate = new Date('2026-01-01T00:00:00Z');
  const startsAt = new Date(startsDate);
  startsAt.setHours(6, 0, 0, 0);
  const endsAt = new Date(startsDate);
  endsAt.setHours(10, 0, 0, 0);

  function makeMediaItem(id: string): MediaItem {
    return {
      id,
      sessionId: 'session-1',
      photographerId: 'photographer-1',
      spotId: null,
      capturedAt: new Date('2026-01-01T00:00:00Z'),
      price: null,
      lightboxUrl: `https://cdn.example.com/${id}.jpg`,
      thumbnailUrl: `https://cdn.example.com/${id}-thumb.jpg`,
      cloudinaryPublicId: id,
      status: 'DRAFT',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      resource: {
        resourceType: 'image',
        url: `https://cdn.example.com/${id}.jpg`,
        assetId: `asset-${id}`,
      },
    };
  }

  function completedQueue(mediaIds: string[]): GalleryCard[] {
    return mediaIds.map((mediaId) => ({
      kind: 'draft' as const,
      id: mediaId,
      result: makeMediaItem(mediaId),
    }));
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('publishes a valid session and clears only transient upload state', async () => {
    mocks.createAndPublish.mockResolvedValue({ id: 'session-1' });
    const onCancel = vi.fn();
    const { result } = renderHook(() =>
      usePublishUploadSession({
        draftId: 'draft-1',
        spot: { id: 'spot-1' },
        queue: completedQueue(['media-1', 'media-2']),
        sessionDate: startsDate,
        sessionRange: [360, 600],
        photoPrice: 300,
        videoPrice: 500,
        onCancel,
      }),
    );

    await act(async () => {
      await result.current.publish();
    });

    expect(mocks.createAndPublish).toHaveBeenCalledWith('draft-1');
    expect(mocks.invalidateQueries).not.toHaveBeenCalled();
    expect(mocks.clearQueue).toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalled();
  });

  it('does not publish while any upload card still needs user action', async () => {
    const onPublishFailed = vi.fn();
    const { result } = renderHook(() =>
      usePublishUploadSession({
        draftId: 'draft-1',
        spot: null,
        queue: [],
        sessionDate: startsDate,
        sessionRange: [360, 600],
        photoPrice: 300,
        videoPrice: 500,
        onCancel: vi.fn(),
        onPublishFailed,
      }),
    );

    await act(async () => {
      await result.current.publish();
    });

    expect(result.current.hasTriedPublish).toBe(true);
    expect(result.current.filesErrorTick).toBe(1);
    expect(onPublishFailed).toHaveBeenCalled();
    expect(mocks.createAndPublish).not.toHaveBeenCalled();
  });

  it('notifies and keeps the queue open when publishing fails', async () => {
    mocks.createAndPublish.mockRejectedValue(new Error('Network down'));
    const onCancel = vi.fn();
    const { result } = renderHook(() =>
      usePublishUploadSession({
        draftId: 'draft-1',
        spot: { id: 'spot-1' },
        queue: completedQueue(['media-1']),
        sessionDate: startsDate,
        sessionRange: [360, 600],
        photoPrice: 300,
        videoPrice: 500,
        onCancel,
      }),
    );

    await act(async () => {
      await result.current.publish();
    });

    expect(mocks.notifyError).toHaveBeenCalledWith('Network down', 'Publish Failed');
    expect(mocks.clearQueue).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('does not publish while any upload card still needs user action', async () => {
    mocks.createAndPublish.mockResolvedValue({ id: 'session-1' });
    const onCancel = vi.fn();
    const queue = [
      ...completedQueue(['media-1']),
      {
        kind: 'attempt' as const,
        id: 'upload-2',
        source: 'LOCAL' as const,
        status: 'FAILED' as const,
        previewUrl: 'blob:failed',
      },
    ] satisfies GalleryCard[];

    const { result } = renderHook(() =>
      usePublishUploadSession({
        draftId: 'draft-1',
        spot: { id: 'spot-1' },
        queue,
        sessionDate: startsDate,
        sessionRange: [360, 600],
        photoPrice: 300,
        videoPrice: 500,
        onCancel,
      }),
    );

    await act(async () => {
      await result.current.publish();
    });

    expect(result.current.hasTriedPublish).toBe(true);
    expect(mocks.createAndPublish).not.toHaveBeenCalled();
    expect(mocks.clearQueue).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('does not publish while any upload card is still active', async () => {
    mocks.createAndPublish.mockResolvedValue({ id: 'session-1' });
    const onCancel = vi.fn();
    const queue = [
      ...completedQueue(['media-1']),
      {
        kind: 'attempt' as const,
        id: 'upload-2',
        source: 'LOCAL' as const,
        status: 'ACQUIRING' as const,
        previewUrl: 'blob:active',
        progress: 50,
      },
    ] satisfies GalleryCard[];

    const { result } = renderHook(() =>
      usePublishUploadSession({
        draftId: 'draft-1',
        spot: { id: 'spot-1' },
        queue,
        sessionDate: startsDate,
        sessionRange: [360, 600],
        photoPrice: 300,
        videoPrice: 500,
        onCancel,
      }),
    );

    await act(async () => {
      await result.current.publish();
    });

    expect(result.current.hasTriedPublish).toBe(true);
    expect(result.current.filesErrorTick).toBe(1);
    expect(mocks.createAndPublish).not.toHaveBeenCalled();
    expect(mocks.clearQueue).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });
});
