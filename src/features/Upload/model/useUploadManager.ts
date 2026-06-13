import { useCallback } from 'react';
import { useDeleteMedia, useDeleteOrphanAsset, useSignCloudinary, useCreateMedia, useInvalidateSessionlessDrafts, MediaItem, MEDIA_UPLOAD_LIMITS } from 'entities/Media';
import { useUploadStore } from 'features/Upload/model/uploadStore';
import { v4 as uuidv4 } from 'uuid';
import { notify } from 'shared/lib/notifications';
import { UploadError } from './UploadError';
import { UploadItem } from './types';
import { createUploadPipeline } from './UploadPipeline';

/**
 * Revoke blob URL to prevent memory leaks
 */
function revokeBlobUrl(url?: string): void {
  if (url?.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
}

/**
 * Manages upload queue operations in business terms:
 * - Users select files → add to queue
 * - Files upload through stages → track progress
 * - Users cancel/retry/remove → handle gracefully
 *
 * Implementation details hidden in UploadPipeline.
 * Metadata updates (price/date) are owned by TanStack Query via useDraftEditing.
 */
export const useUploadManager = (
  spotId: string,
  sessionId: string | null,
) => {
  const { mutateAsync: deleteMedia } = useDeleteMedia();
  const { mutateAsync: deleteOrphanAsset } = useDeleteOrphanAsset();
  const { mutateAsync: signCloudinary } = useSignCloudinary();
  const { mutateAsync: createMedia } = useCreateMedia();
  const invalidateSessionlessDrafts = useInvalidateSessionlessDrafts(spotId);

  // ========================================================================
  // UPLOAD ORCHESTRATION - How uploads happen (implementation)
  // Defined first so business-logic callbacks can reference processUpload without stale closures.
  // ========================================================================

  const processUpload = useCallback(async (
    id: string,
    file: File | null
  ) => {
    if (!file) return;

    const pipeline = createPipeline(id, spotId, sessionId, { signCloudinary, createMedia });
    let mediaItem: MediaItem;

    // True if the item was removed from the queue (user discarded or cancelled) while we were awaiting.
    // Safe to call at any await boundary — reads live store state, not a stale closure.
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
        // Retry scenario: reuse existing Cloudinary upload
        cloudResult = existingCloudinaryResult;
        store.updateItem(id, { status: 'saving', progress: 100 });
      } else {
        // Normal flow: sign → upload → save
        cloudResult = await uploadNewFile(id, file, pipeline);
        // Item may have been removed while Cloudinary upload was in-flight (signing/uploading race).
        if (isDiscarded()) {
          void deleteOrphanAsset({ publicId: cloudResult.publicId, resourceType: cloudResult.resource_type });
          return;
        }
        store.updateItem(id, { cloudinaryResult: cloudResult });
      }

      mediaItem = await pipeline.saveToDatabase(cloudResult, exifData);
      // Item may have been removed while DB write was in-flight (saving race).
      if (isDiscarded()) {
        void deleteMedia({ id: mediaItem.id });
        return;
      }
      pipeline.complete(mediaItem.id, mediaItem.capturedAt ?? undefined);
      void invalidateSessionlessDrafts();
    } catch (error: unknown) {
      const errorMessage = pipeline.handleError(error);

      if (errorMessage) {
        notify.error(`${file.name}: ${errorMessage}`, 'Upload Failed');
      }

    }
  }, [spotId, sessionId, signCloudinary, createMedia, invalidateSessionlessDrafts, deleteOrphanAsset, deleteMedia]);

  // ========================================================================
  // BUSINESS LOGIC - What users can do (high-level)
  // ========================================================================

  /**
   * User selects files to upload
   */
  const addFiles = useCallback((files: File[]) => {
    const store = useUploadStore.getState();
    const newItems = createPendingItems(files, spotId, sessionId);
    store.addToQueue(newItems);
    newItems.forEach(item => processUpload(item.id, item.file));
  }, [spotId, sessionId, processUpload]);

  /**
   * User cancels an upload (only aborts, doesn't delete from DB)
   * Used during "Cancel Uploads" to avoid race conditions with completing uploads
   */
  const cancelUpload = useCallback(async (id: string) => {
    const store = useUploadStore.getState();
    const item = store.uploadQueue.find(i => i.id === id);
    if (!item) return;

    // Only abort if still uploading - don't delete completed items from DB
    await abortIfUploading(item);
    revokeBlobUrl(item.previewUrl);
    store.removeItem(id);
  }, []);

  /**
   * User removes an upload (in-progress or completed)
   */
  const remove = useCallback(async (id: string) => {
    const store = useUploadStore.getState();
    const item = store.uploadQueue.find(i => i.id === id);

    // If not in uploadQueue, it's a draft from DB (exists only in merged queue)
    if (!item) {
      try {
        await deleteMedia({ id });
        // Clean up any lingering Zustand completed item with this DB id.
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

    // For items in uploadQueue (actively uploaded or in progress)
    await abortIfUploading(item);

    // Cloudinary upload succeeded but DB save never reached the server — orphaned asset
    if (item.status === 'error' && item.cloudinaryResult && !item.mediaId) {
      deleteOrphanAsset({ publicId: item.cloudinaryResult.publicId, resourceType: item.cloudinaryResult.resource_type })
        .catch(() => notify.error('Failed to clean up upload — please contact support', 'Cleanup Error'));
    }

    // If completed, delete from DB and mark as deleted
    if (item.status === 'completed' && item.mediaId) {
      try {
        await deleteMedia({ id: item.mediaId });
      } catch {
        return;
      }
    }

    revokeBlobUrl(item.previewUrl);
    store.removeItem(item.id);
  }, [deleteMedia, deleteOrphanAsset]);

  /**
   * User retries a failed upload
   */
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
   * Two-pass: immediate Zustand clear, then background server cleanup.
   * allItems is the full merged list so DB-only drafts are also deleted.
   */
  const discardAll = useCallback((allItems: Array<{ id: string; mediaId?: string }>) => {
    const store = useUploadStore.getState();
    const queue = store.uploadQueue;

    const toDeleteDb: string[] = [];
    const toDeleteOrphan: Array<{ publicId: string; resourceType: 'image' | 'video' }> = [];

    queue.forEach(item => {
      if (item.status === 'completed' && item.mediaId) {
        toDeleteDb.push(item.mediaId);
      } else if (item.status === 'error' && item.cloudinaryResult && !item.mediaId) {
        toDeleteOrphan.push({ publicId: item.cloudinaryResult.publicId, resourceType: item.cloudinaryResult.resource_type });
      }
    });

    const queueIds = new Set(queue.map(i => i.id));
    allItems.forEach(item => {
      if (!queueIds.has(item.id) && item.mediaId) {
        toDeleteDb.push(item.mediaId);
      }
    });

    store.clearQueue();

    toDeleteDb.forEach(mediaId => void deleteMedia({ id: mediaId }));
    toDeleteOrphan.forEach(o => void deleteOrphanAsset(o));
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
// MODULE-LEVEL HELPERS - No hook deps; accept all inputs as explicit params
// ===========================================================================

function createPipeline(
  id: string,
  spotId: string,
  sessionId: string | null,
  client: Parameters<typeof createUploadPipeline>[3],
) {
  return createUploadPipeline(
    spotId,
    sessionId,
    (updates) => {
      // Update store even if component unmounted (background uploads).
      useUploadStore.getState().updateItem(id, updates);
    },
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

function isUploading(status: string) {
  return ['signing', 'uploading', 'saving'].includes(status);
}

function canRetry(item: UploadItem | undefined) {
  return item && item.status === 'error' && item.file;
}

// ===========================================================================
// PURE FUNCTIONS - No side effects, easy to test
// ===========================================================================

function createPendingItems(files: File[], spotId: string, sessionId: string | null): UploadItem[] {
  return files.map((file) => ({
    id: uuidv4(),
    spotId,
    sessionId,
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
