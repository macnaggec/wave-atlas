import { useCallback } from 'react';
import { useDeleteMedia, useDeleteOrphanAsset, useSignCloudinary, useCreateMedia, useInvalidateMyDrafts, MediaItem, MEDIA_UPLOAD_LIMITS } from 'entities/Media';
import { useUploadStore } from 'features/Upload/model/uploadStore';
import { v4 as uuidv4 } from 'uuid';
import { notify } from 'shared/lib/notifications';
import { UploadError } from './UploadError';
import { GalleryCard, UploadItem } from './types';
import { isUploading, revokeBlobUrl, isOrphanAsset } from './types';
import { createUploadPipeline } from './UploadPipeline';

/**
 * Manages upload queue operations in business terms:
 * - Users select files → add to queue
 * - Files upload through stages → track progress
 * - Users cancel/retry/remove → handle gracefully
 *
 * Implementation details hidden in UploadPipeline.
 */
export const useUploadManager = () => {
  const { mutateAsync: deleteMedia } = useDeleteMedia();
  const { mutateAsync: deleteOrphanAsset } = useDeleteOrphanAsset();
  const { mutateAsync: signCloudinary } = useSignCloudinary();
  const { mutateAsync: createMedia } = useCreateMedia();
  const invalidateMyDrafts = useInvalidateMyDrafts();

  // ========================================================================
  // UPLOAD ORCHESTRATION - How uploads happen (implementation)
  // ========================================================================

  const processUpload = useCallback(async (
    id: string,
    file: File | null
  ) => {
    if (!file) return;

    const pipeline = createPipeline(id, { signCloudinary, createMedia });
    let mediaItem: MediaItem;

    const isDiscarded = () => !useUploadStore.getState().uploadQueue.find(i => i.id === id);

    try {
      validateFileSize(file);
      const exifData = await pipeline.extractMetadata(file);
      const store = useUploadStore.getState();
      const existingCloudinaryResult = store.uploadQueue
        .find(i => i.id === id)
        ?.cloudinaryResult;

      let cloudResult;

      if (existingCloudinaryResult) {
        cloudResult = existingCloudinaryResult;
        store.updateItem(id, { status: 'saving', progress: 100 });
      } else {
        cloudResult = await uploadNewFile(id, file, pipeline);
        if (isDiscarded()) {
          void deleteOrphanAsset({ publicId: cloudResult.publicId, resourceType: cloudResult.resource_type });
          return;
        }
        store.updateItem(id, { cloudinaryResult: cloudResult });
      }

      mediaItem = await pipeline.saveToDatabase(cloudResult, exifData);
      if (isDiscarded()) {
        void deleteMedia({ id: mediaItem.id });
        return;
      }
      pipeline.complete(mediaItem.id, mediaItem.capturedAt ?? undefined);
      void invalidateMyDrafts();
    } catch (error: unknown) {
      const errorMessage = pipeline.handleError(error);

      if (errorMessage) {
        notify.error(`${file.name}: ${errorMessage}`, 'Upload Failed');
      }
    }
  }, [signCloudinary, createMedia, invalidateMyDrafts, deleteOrphanAsset, deleteMedia]);

  // ========================================================================
  // BUSINESS LOGIC - What users can do (high-level)
  // ========================================================================

  const addFiles = useCallback((files: File[]) => {
    const store = useUploadStore.getState();
    const newItems = createPendingItems(files);
    store.addToQueue(newItems);
    newItems.forEach(item => processUpload(item.id, item.file));
  }, [processUpload]);

  const cancelUpload = useCallback(async (id: string) => {
    const store = useUploadStore.getState();
    const item = store.uploadQueue.find(i => i.id === id);
    if (!item) return;

    await abortIfUploading(item);
    revokeBlobUrl(item.previewUrl);
    store.removeItem(id);
  }, []);

  /**
   * User removes an upload (in-progress, completed, or server-only draft).
   * Dispatches on kind — reads live store state to avoid stale snapshot.
   */
  const remove = useCallback(async (kind: GalleryCard['kind'], id: string) => {
    if (kind === 'draft') {
      try {
        await deleteMedia({ id });
        // Clean up any lingering Zustand completed item that references this DB row.
        const store = useUploadStore.getState();
        const lingering = store.uploadQueue.find(i => i.mediaId === id);
        if (lingering) {
          revokeBlobUrl(lingering.previewUrl);
          store.removeItem(lingering.id);
        }
      } catch {
        // notification handled by useDeleteMedia onError
      }
      return;
    }

    // kind: 'uploading' — re-read live state; id = item.mediaId ?? item.id
    const item = useUploadStore.getState().uploadQueue.find(i => i.mediaId === id || i.id === id);
    if (!item) return;

    await abortIfUploading(item);

    if (isOrphanAsset(item)) {
      deleteOrphanAsset({ publicId: item.cloudinaryResult.publicId, resourceType: item.cloudinaryResult.resource_type })
        .catch(() => notify.error('Failed to clean up upload — please contact support', 'Cleanup Error'));
    }

    if (item.status === 'completed' && item.mediaId) {
      try {
        await deleteMedia({ id: item.mediaId });
      } catch {
        return;
      }
    }

    revokeBlobUrl(item.previewUrl);
    useUploadStore.getState().removeItem(item.id);
  }, [deleteMedia, deleteOrphanAsset]);

  const retry = useCallback((id: string) => {
    const store = useUploadStore.getState();
    const item = store.uploadQueue.find(i => i.id === id);
    if (!canRetry(item) || !item) return;

    store.updateItem(id, {
      status: 'pending',
      progress: 0,
      error: undefined,
    });
    processUpload(id, item.file!);
  }, [processUpload]);

  /**
   * User discards everything (Discard button in upload modal).
   * Re-reads live item state from store to avoid stale pipelineItem snapshot.
   */
  const discardAll = useCallback((allCards: GalleryCard[]) => {
    const store = useUploadStore.getState();

    allCards.forEach(card => {
      if (card.kind === 'draft') {
        void deleteMedia({ id: card.result.id });
      } else {
        const item = store.uploadQueue.find(i => i.id === card.pipelineItem.id) ?? card.pipelineItem;
        revokeBlobUrl(item.previewUrl);
        if (isUploading(item.status)) {
          try { item.abortUpload?.(); } catch { /* abort errors expected */ }
        } else if (item.status === 'completed' && item.mediaId) {
          void deleteMedia({ id: item.mediaId });
        } else if (isOrphanAsset(item)) {
          void deleteOrphanAsset({ publicId: item.cloudinaryResult.publicId, resourceType: item.cloudinaryResult.resource_type });
        }
      }
    });

    store.clearQueue();
  }, [deleteMedia, deleteOrphanAsset]);

  // ========================================================================
  // PUBLIC API
  // ========================================================================

  return {
    addFiles,
    remove,
    cancelUpload,
    discardAll,
    retry,
  };
};

// ===========================================================================
// MODULE-LEVEL HELPERS
// ===========================================================================

function createPipeline(
  id: string,
  client: Parameters<typeof createUploadPipeline>[1],
) {
  return createUploadPipeline(
    (updates) => { useUploadStore.getState().updateItem(id, updates); },
    client,
  );
}

async function uploadNewFile(
  id: string,
  file: File,
  pipeline: ReturnType<typeof createUploadPipeline>,
) {
  const signature = await pipeline.getSignature();

  const { promise, abort } = pipeline.uploadToCloud(
    file,
    signature,
    (progress) => { useUploadStore.getState().updateItem(id, { progress }); },
  );

  useUploadStore.getState().updateItem(id, { abortUpload: abort });
  return promise;
}

async function abortIfUploading(item: UploadItem) {
  if (item.abortUpload && isUploading(item.status)) {
    try { item.abortUpload(); } catch { /* abort errors expected */ }
  }
}

function canRetry(item: UploadItem | undefined) {
  return item && item.status === 'error' && item.file;
}

// ===========================================================================
// PURE FUNCTIONS
// ===========================================================================

function createPendingItems(files: File[]): UploadItem[] {
  return files.map((file) => ({
    id: uuidv4(),
    file,
    previewUrl: URL.createObjectURL(file),
    status: 'pending' as const,
    progress: 0,
  }));
}

function validateFileSize(file: File): void {
  const maxSize = file.type.startsWith('video/')
    ? MEDIA_UPLOAD_LIMITS.MAX_FILE_SIZE_VIDEO
    : MEDIA_UPLOAD_LIMITS.MAX_FILE_SIZE_IMAGE;

  if (file.size > maxSize) {
    const limitMb = maxSize / 1024 / 1024;
    throw new UploadError('FILE_TOO_LARGE', `File exceeds the ${limitMb} MB limit`);
  }
}
