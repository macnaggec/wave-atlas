import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useUploadManager } from './useUploadManager';
import { useUploadStore } from './uploadStore';

const mocks = vi.hoisted(() => ({
  deleteDraftMedia: vi.fn(),
  discardAttempt: vi.fn(),
  discardDraft: vi.fn(),
  notifyError: vi.fn(),
  revokeBlobUrl: vi.fn(),
}));

vi.mock('./useUploadCommands', () => ({
  useUploadCommands: () => ({
    deleteDraftMedia: mocks.deleteDraftMedia,
    discard: mocks.discardAttempt,
    discardDraft: mocks.discardDraft,
  }),
}));

vi.mock('./useGooglePicker', () => ({
  requestDriveAccessToken: vi.fn(),
}));

vi.mock('shared/lib/notifications', () => ({
  notify: { error: mocks.notifyError },
}));

describe('useUploadManager cleanup dispatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.deleteDraftMedia.mockResolvedValue(undefined);
    mocks.discardAttempt.mockResolvedValue(undefined);
    mocks.discardDraft.mockResolvedValue(undefined);
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: mocks.revokeBlobUrl,
    });
  });

  afterEach(() => {
    useUploadStore.setState({ transfers: new Map() });
  });

  it('deletes a finalized draft card through the media lifecycle', async () => {
    const { result } = renderHook(() => useUploadManager('draft-1'));

    await act(async () => {
      await result.current.remove('draft', 'media-1');
    });

    expect(mocks.deleteDraftMedia).toHaveBeenCalledWith({ id: 'media-1' });
    expect(mocks.discardAttempt).not.toHaveBeenCalled();
  });

  it('releases browser resources and discards an upload-attempt card', async () => {
    const abort = vi.fn();
    useUploadStore.getState().addTransfer({
      source: 'local',
      clientRequestId: 'request-1',
      attemptId: 'attempt-1',
      file: new File(['photo'], 'photo.jpg', { type: 'image/jpeg' }),
      previewUrl: 'blob:preview-1',
      progress: 50,
      abort,
    });
    const { result } = renderHook(() => useUploadManager('draft-1'));

    await act(async () => {
      await result.current.remove('attempt', 'attempt-1');
    });

    expect(abort).toHaveBeenCalledOnce();
    expect(mocks.revokeBlobUrl).toHaveBeenCalledWith('blob:preview-1');
    expect(mocks.discardAttempt).toHaveBeenCalledWith({ attemptId: 'attempt-1' });
    expect(useUploadStore.getState().getAll()).toEqual([]);
  });

  it('keeps the upload-attempt card and preview when server discard fails', async () => {
    const abort = vi.fn();
    mocks.discardAttempt.mockRejectedValueOnce(new Error('network down'));
    useUploadStore.getState().addTransfer({
      source: 'local',
      clientRequestId: 'request-1',
      attemptId: 'attempt-1',
      file: new File(['photo'], 'photo.jpg', { type: 'image/jpeg' }),
      previewUrl: 'blob:preview-1',
      progress: 50,
      abort,
    });
    const { result } = renderHook(() => useUploadManager('draft-1'));

    await act(async () => {
      await result.current.remove('attempt', 'attempt-1');
    });

    expect(abort).toHaveBeenCalledOnce();
    expect(mocks.revokeBlobUrl).not.toHaveBeenCalled();
    expect(useUploadStore.getState().getAll()).toHaveLength(1);
    expect(mocks.notifyError).toHaveBeenCalledWith('network down', 'Delete Failed');
  });

  it('keeps upload cards and previews when discard-all fails', async () => {
    const abort = vi.fn();
    mocks.discardDraft.mockRejectedValueOnce(new Error('network down'));
    useUploadStore.getState().addTransfer({
      source: 'local',
      clientRequestId: 'request-1',
      attemptId: 'attempt-1',
      file: new File(['photo'], 'photo.jpg', { type: 'image/jpeg' }),
      previewUrl: 'blob:preview-1',
      progress: 50,
      abort,
    });
    const { result } = renderHook(() => useUploadManager('draft-1'));

    await act(async () => {
      await expect(result.current.discardAll()).rejects.toThrow('network down');
    });

    expect(abort).toHaveBeenCalledOnce();
    expect(mocks.revokeBlobUrl).not.toHaveBeenCalled();
    expect(useUploadStore.getState().getAll()).toHaveLength(1);
    expect(mocks.notifyError).toHaveBeenCalledWith('network down', 'Discard Failed');
  });
});
