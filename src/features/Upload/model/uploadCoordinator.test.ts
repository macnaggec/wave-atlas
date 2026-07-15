import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UploadCommands } from './useUploadCommands';
import { startDriveUpload, startLocalUpload } from './uploadCoordinator';
import { useUploadStore } from './uploadStore';

const mocks = vi.hoisted(() => ({
  uploadToCloudinary: vi.fn(),
  revokeObjectURL: vi.fn(),
}));

vi.mock('uuid', () => ({ v4: () => 'client-request-1' }));

vi.mock('./cloudinaryTransport', () => ({
  uploadToCloudinary: mocks.uploadToCloudinary,
}));

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function makeCommands(overrides: Partial<Record<keyof UploadCommands, unknown>> = {}): UploadCommands {
  return {
    beginLocal: vi.fn().mockResolvedValue({
      attemptId: 'attempt-1',
      signature: 'signature',
      timestamp: 1,
      apiKey: 'api-key',
      cloudName: 'cloud-name',
      cloudinaryPublicId: 'public-id',
      eager: 'thumbnail|lightbox',
    }),
    finalizeLocal: vi.fn().mockResolvedValue(undefined),
    beginDrive: vi.fn().mockResolvedValue({ attemptId: 'attempt-1' }),
    processDrive: vi.fn().mockResolvedValue(undefined),
    discard: vi.fn().mockResolvedValue(undefined),
    cancelWorkspace: vi.fn().mockResolvedValue(undefined),
    stageMediaRemoval: vi.fn().mockResolvedValue(undefined),
    unstageMediaRemoval: vi.fn().mockResolvedValue(undefined),
    deleteWorkspaceAsset: vi.fn().mockResolvedValue(undefined),
    invalidateWorkspaceState: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as UploadCommands;
}

beforeEach(() => {
  vi.clearAllMocks();
  useUploadStore.setState({ transfers: new Map() });
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: vi.fn(() => 'blob:preview-1'),
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: mocks.revokeObjectURL,
  });
  mocks.uploadToCloudinary.mockReturnValue({
    promise: Promise.resolve({
      publicId: 'public-id',
      thumbnailUrl: 'https://example.com/thumbnail.jpg',
      lightboxUrl: 'https://example.com/lightbox.jpg',
      resourceType: 'image',
    }),
    abort: vi.fn(),
  });
});

describe('upload coordinator workspace handoff', () => {
  it('keeps a completed local transfer visible until its workspace asset refresh finishes', async () => {
    const refresh = deferred<void>();
    const invalidateWorkspaceState = vi.fn(() => refresh.promise);
    const commands = makeCommands({ invalidateWorkspaceState });

    const upload = startLocalUpload(
      new File(['photo'], 'photo.jpg', { type: 'image/jpeg' }),
      { commands, workspaceId: 'workspace-lazy' },
    );

    await vi.waitFor(() => {
      expect(invalidateWorkspaceState).toHaveBeenCalledWith('workspace-lazy');
    });
    expect(useUploadStore.getState().getAll()).toHaveLength(1);

    refresh.resolve();
    await upload;

    expect(useUploadStore.getState().getAll()).toHaveLength(0);
  });

  it('keeps a completed Drive transfer visible until its workspace asset refresh finishes', async () => {
    const refresh = deferred<void>();
    const invalidateWorkspaceState = vi.fn(() => refresh.promise);
    const commands = makeCommands({ invalidateWorkspaceState });

    const upload = startDriveUpload({
      remoteFileId: 'drive-file-1',
      declaredMimeType: 'image/jpeg',
      thumbnailUrl: 'https://example.com/drive-thumbnail.jpg',
      accessToken: 'drive-token',
    }, { commands, workspaceId: 'workspace-lazy' });

    await vi.waitFor(() => {
      expect(invalidateWorkspaceState).toHaveBeenCalledWith('workspace-lazy');
    });
    expect(useUploadStore.getState().getAll()).toHaveLength(1);

    refresh.resolve();
    await upload;

    expect(useUploadStore.getState().getAll()).toHaveLength(0);
  });
});
