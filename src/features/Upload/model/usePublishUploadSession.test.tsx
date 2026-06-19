import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePublishUploadSession } from './usePublishUploadSession';
import type { GalleryCard } from './types';

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

  function completedQueue(mediaIds: string[]): GalleryCard[] {
    return mediaIds.map((mediaId) => ({
      kind: 'uploading',
      id: mediaId,
      pipelineItem: {
        id: `upload-${mediaId}`,
        file: new File(['ok'], `${mediaId}.jpg`, { type: 'image/jpeg' }),
        previewUrl: `blob:${mediaId}`,
        status: 'completed',
        progress: 100,
        mediaId,
      },
    }));
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('publishes a valid upload session and clears local upload state', async () => {
    mocks.createAndPublish.mockResolvedValue({ id: 'session-1' });
    const onCancel = vi.fn();
    const { result } = renderHook(() =>
      usePublishUploadSession({
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

    expect(mocks.createAndPublish).toHaveBeenCalledWith({
      spotId: 'spot-1',
      startsAt,
      endsAt,
      mediaIds: ['media-1', 'media-2'],
      photoPrice: 300,
      videoPrice: 500,
    });
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['users', 'myDraftCounts'] });
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['media', 'myDrafts'] });
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['users', 'myUploads'] });
    expect(mocks.clearQueue).toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalled();
  });

  it('marks missing spot and empty files as attempted publish errors', async () => {
    const onPublishFailed = vi.fn();
    const { result } = renderHook(() =>
      usePublishUploadSession({
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
      {
        kind: 'uploading',
        id: 'media-1',
        pipelineItem: {
          id: 'upload-1',
          file: new File(['ok'], 'ok.jpg', { type: 'image/jpeg' }),
          previewUrl: 'blob:ok',
          status: 'completed',
          progress: 100,
          mediaId: 'media-1',
        },
      },
      {
        kind: 'uploading',
        id: 'upload-2',
        pipelineItem: {
          id: 'upload-2',
          file: new File(['failed'], 'failed.jpg', { type: 'image/jpeg' }),
          previewUrl: 'blob:failed',
          status: 'error',
          progress: 0,
          error: 'Upload failed',
        },
      },
    ] satisfies GalleryCard[];

    const { result } = renderHook(() =>
      usePublishUploadSession({
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
        kind: 'uploading',
        id: 'upload-2',
        pipelineItem: {
          id: 'upload-2',
          file: new File(['active'], 'active.jpg', { type: 'image/jpeg' }),
          previewUrl: 'blob:active',
          status: 'uploading',
          progress: 50,
        },
      },
    ] satisfies GalleryCard[];

    const { result } = renderHook(() =>
      usePublishUploadSession({
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
