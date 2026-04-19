import { useCallback, useEffect } from 'react';
import { useDeleteMedia } from 'entities/Media/model/useDeleteMedia';
import { useUploadStore } from 'features/Upload/model/uploadStore';
import { v4 as uuidv4 } from 'uuid';
import { UploadItem } from './types';
import { UploadPipeline } from './UploadPipeline';
import { useDraftMediaMutate } from './useDraftMedia';

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
  spotName: string | null = null
) => {
  const draftCache = useDraftMediaMutate(spotId);
  const { mutateAsync: deleteMedia } = useDeleteMedia();

  // ========================================================================
  // SETUP - Initialize context for this spot
  //========================================================================

  // Set spot context when manager is active
  // why in useEffect? We want to set the context when the component mounts, but we also want to avoid setting it if another spot is actively uploading. By checking the Zustand store for active uploads, we can conditionally set the context only if it's safe to do so. This prevents conflicts between multiple instances of UploadManager across different spots.
  useEffect(() => {
    const store = useUploadStore.getState();

    // Only set upload context if no other spot is actively uploading.
    // Completed items are removed from Zustand once SWR confirms them (see processUpload).
    const hasActiveUploadsForOtherSpot = store.uploadQueue.some(
      item => item.spotId !== spotId
    );

    if (!hasActiveUploadsForOtherSpot) {
      store.setSpotContext(spotId, spotName);
    }
  }, [spotId, spotName]);

  // ========================================================================
  // BUSINESS LOGIC - What users can do (high-level)
  // ========================================================================

  /**
   * User selects files to upload
   */
  const addFiles = useCallback((files: File[]) => {
    const store = useUploadStore.getState();

    // Guard: Prevent upload if another spot is actively uploading
    const globalHasActiveUploads = store.uploadQueue.some(
      item => item.status !== 'completed' && item.status !== 'error'
    );
    const uploadingSpotId = store.uploadingSpotId;
    const isBlocked = globalHasActiveUploads && uploadingSpotId !== spotId;

    if (isBlocked) {
      // Early return - UI already shows disabled state with tooltip
      return;
    }

    // Set upload context when actually starting uploads
    store.setSpotContext(spotId, spotName);

    const newItems = createPendingItems(files, spotId);
    store.addToQueue(newItems);
    startUploads(newItems);
  }, [spotId, spotName]);

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
        void draftCache.remove(id);
      } catch {
        // notification handled by useDeleteMedia onError
      }
      return;
    }

    // For items in uploadQueue (actively uploaded or in progress)
    await abortIfUploading(item);

    // If completed, delete from DB and mark as deleted
    if (item.status === 'completed' && item.mediaId) {
      try {
        await deleteIfCompleted(item);
        void draftCache.remove(item.mediaId);
      } catch {
        return;
      }
    }

    revokeBlobUrl(item.previewUrl);
    store.removeItem(item.id);
  }, [draftCache, deleteMedia]);

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
  }, [spotId]);

  /**
   * System removes published items from queue
   */
  const removeByMediaIds = useCallback((mediaIds: string[]) => {
    const store = useUploadStore.getState();
    const toRemove = store.uploadQueue.filter(item =>
      item.mediaId && mediaIds.includes(item.mediaId)
    );
    toRemove.forEach(item => {
      revokeBlobUrl(item.previewUrl);
      store.removeItem(item.id);
    });
  }, []);

  /**
   * User clears all completed uploads
   */
  const clearCompleted = useCallback(() => {
    const store = useUploadStore.getState();
    store.uploadQueue
      .filter(i => i.status === 'completed')
      .forEach(i => revokeBlobUrl(i.previewUrl));
    store.clearCompleted();
  }, []);

  // ========================================================================
  // UPLOAD ORCHESTRATION - How uploads happen (implementation)
  // ========================================================================

  const processUpload = useCallback(async (
    id: string,
    file: File | null
  ) => {
    if (!file) return;

    const pipeline = createPipeline(id);
    let mediaItem: ReturnType<UploadPipeline['saveToDatabase']> extends Promise<infer T> ? T : never;

    try {
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
        store.updateItem(id, { cloudinaryResult: cloudResult });
      }

      mediaItem = await pipeline.saveToDatabase(cloudResult, exifData);
      pipeline.complete(mediaItem.id);
      useUploadStore.getState().incrementSessionCompleted();

    } catch (error: unknown) {
      pipeline.handleError(error, file);
      return;
    }

    // Upload succeeded — write the confirmed MediaItem directly into SWR's cache.
    // This bypasses the 'use cache' layer which may still serve stale data due to
    // revalidateTag propagation delay. SWR's cache update triggers a re-render in
    // useDraftMedia → useUploadQueue dedup hides the Zustand copy in the same cycle.
    //
    // The Zustand item carries only mediaId now. TQ is the single source of truth
    // for MediaItem data. Writing to TQ here makes the result immediately visible
    // in useUploadQueue without any promotion logic.
    void draftCache.append(mediaItem);
  }, [spotId, draftCache]);

  const startUploads = (items: UploadItem[]) => {
    // client uuids
    items.forEach((item) => {
      processUpload(item.id, item.file);
    });
  };

  const createPipeline = (id: string) => {
    return new UploadPipeline(
      spotId,
      (updates) => {
        // Update store even if component unmounted (background uploads).
        const store = useUploadStore.getState();
        store.updateItem(id, updates);
      },
    );
  };

  const uploadNewFile = async (id: string, file: File, pipeline: UploadPipeline) => {
    const signature = await pipeline.getSignature();

    const { promise, abort } = pipeline.uploadToCloud(
      file,
      signature,
      (progress) => {
        const store = useUploadStore.getState();
        store.updateItem(id, { progress });
      },
    );

    const store = useUploadStore.getState();
    store.updateItem(id, { abortUpload: abort });

    return await promise;
  };

  // ========================================================================
  // HELPERS - Supporting operations
  // ========================================================================

  const abortIfUploading = async (item: UploadItem) => {
    if (item.abortUpload && isUploading(item.status)) {
      try {
        item.abortUpload();
      } catch (err) {
        // Abort errors expected
      }
    }
  };

  const deleteIfCompleted = async (item: UploadItem) => {
    if (item.status === 'completed' && item.mediaId) {
      await deleteMedia({ id: item.mediaId });
      // rejection propagates; onError in useDeleteMedia handles notification
    }
  };

  const isUploading = (status: string) => {
    return ['signing', 'uploading', 'saving'].includes(status);
  };

  const canRetry = (item: UploadItem | undefined) => {
    return item && item.status === 'error' && item.file;
  };

  // ========================================================================
  // PUBLIC API
  // ========================================================================

  return {
    addFiles,
    remove,
    cancelUpload,
    removeByMediaIds,
    clearCompleted,
    retry,
  };
};

// ===========================================================================
// PURE FUNCTIONS - No side effects, easy to test
// ===========================================================================

function createPendingItems(files: File[], spotId: string): UploadItem[] {
  return files.map((file) => ({
    id: uuidv4(),
    spotId,
    file,
    previewUrl: URL.createObjectURL(file),
    status: 'pending' as const,
    progress: 0,
  }));
}
