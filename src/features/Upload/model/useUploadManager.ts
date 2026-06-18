import { useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  useDeleteMedia, useDeleteMediaBatch, MediaItem, MEDIA_UPLOAD_LIMITS,
} from 'entities/Media';
import { useTRPC } from 'shared/lib/trpc';
import { useUploadStore } from 'features/Upload/model/uploadStore';
import { v4 as uuidv4 } from 'uuid';
import { notify } from 'shared/lib/notifications';
import { getErrorMessage } from 'shared/lib/getErrorMessage';
import { extractExifData } from 'shared/lib/exifExtractor';
import { UploadError } from './UploadError';
import { GalleryCard, UploadItem, CloudinaryResult, ExifMetadata } from './types';
import { isUploading, revokeBlobUrl, isOrphanAsset } from './types';
import { uploadToCloudinary } from './cloudinaryTransport';
import { signCloudinaryDirect, createMediaDirect } from './mediaApi';

type SignatureData = Awaited<ReturnType<typeof signCloudinaryDirect>>;

// ===========================================================================
// PIPELINE STAGE FUNCTIONS
// Module-level — no React deps, safe to run after component unmount.
// Uses plain tRPC client calls, not React hook instances, for the critical-path server calls.
// ===========================================================================

async function extractMetadata(file: File): Promise<ExifMetadata> {
  const exifData = await extractExifData(file);
  return {
    capturedAt: exifData.capturedAt ?? undefined,
    source: exifData.source === 'fallback' ? 'none' : exifData.source,
  };
}

async function pipelineSign(id: string): Promise<SignatureData> {
  useUploadStore.getState().updateItem(id, { status: 'signing' });
  return await signCloudinaryDirect();
}

function pipelineUpload(
  id: string,
  file: File,
  signature: SignatureData,
): { promise: Promise<CloudinaryResult>; abort: () => void } {
  useUploadStore.getState().updateItem(id, { status: 'uploading', progress: 0 });
  return uploadToCloudinary({
    file,
    signature: signature.signature,
    timestamp: signature.timestamp,
    apiKey: signature.apiKey,
    cloudName: signature.cloudName,
    folder: signature.folder,
    eager: signature.eager,
    onProgress: (progress) => { useUploadStore.getState().updateItem(id, { progress }); },
  });
}

async function pipelineSave(
  id: string,
  cloudResult: CloudinaryResult,
  exifData: ExifMetadata,
): Promise<MediaItem> {
  useUploadStore.getState().updateItem(id, { status: 'saving', progress: 100 });
  const mediaItem = await createMediaDirect({
    cloudinaryResult: cloudResult,
    capturedAt: exifData.capturedAt,
  });
  return exifData.source === 'exif'
    ? { ...mediaItem, dateSource: 'exif' as const }
    : mediaItem;
}

function pipelineComplete(id: string, mediaId: string, capturedAt?: Date): void {
  useUploadStore.getState().updateItem(id, { status: 'completed', mediaId, capturedAt });
}

function pipelineError(id: string, error: unknown): string | null {
  const message = getErrorMessage(error);
  if (message.includes('cancelled') || message.includes('abort')) {
    return null;
  }
  useUploadStore.getState().updateItem(id, { status: 'error', error: message });
  return message;
}

// ===========================================================================
// HOOK
// ===========================================================================

/**
 * Manages upload queue operations in business terms:
 * - Users select files → add to queue
 * - Files upload through stages → track progress
 * - Users cancel/retry/remove → handle gracefully
 */
export const useUploadManager = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { mutateAsync: deleteMedia } = useDeleteMedia();
  const { mutate: deleteMediaBatch } = useDeleteMediaBatch();
  const { mutateAsync: deleteOrphanAsset } = useMutation(trpc.media.deleteOrphanAsset.mutationOptions());

  // ========================================================================
  // UPLOAD ORCHESTRATION - How uploads happen (implementation)
  // ========================================================================

  const processUpload = useCallback(async (
    id: string,
    file: File | null
  ) => {
    if (!file) return;

    const isDiscarded = () => !useUploadStore.getState().uploadQueue.find(i => i.id === id);

    try {
      validateFileSize(file);
      const exifData = await extractMetadata(file);
      const store = useUploadStore.getState();
      const existingCloudinaryResult = store.uploadQueue
        .find(i => i.id === id)
        ?.cloudinaryResult;

      let cloudResult: CloudinaryResult;

      if (existingCloudinaryResult) {
        cloudResult = existingCloudinaryResult;
        store.updateItem(id, { status: 'saving', progress: 100 });
      } else {
        const signature = await pipelineSign(id);
        const { promise, abort } = pipelineUpload(id, file, signature);
        useUploadStore.getState().updateItem(id, { abortUpload: abort });
        cloudResult = await promise;
        if (isDiscarded()) {
          void deleteOrphanAsset({ publicId: cloudResult.publicId, resourceType: cloudResult.resource_type });
          return;
        }
        store.updateItem(id, { cloudinaryResult: cloudResult });
      }

      const mediaItem = await pipelineSave(id, cloudResult, exifData);
      if (isDiscarded()) {
        void deleteMedia({ id: mediaItem.id });
        return;
      }
      pipelineComplete(id, mediaItem.id, mediaItem.capturedAt ?? undefined);
      void queryClient.invalidateQueries({ queryKey: trpc.media.myDrafts.queryKey() });
    } catch (error: unknown) {
      const errorMessage = pipelineError(id, error);
      if (errorMessage) {
        notify.error(`${file.name}: ${errorMessage}`, 'Upload Failed');
      }
    }
  }, [deleteOrphanAsset, deleteMedia, queryClient, trpc]);

  // ========================================================================
  // BUSINESS LOGIC - What users can do (high-level)
  // ========================================================================

  const addFiles = useCallback((files: File[]) => {
    const store = useUploadStore.getState();
    const newItems = createPendingItems(files);
    store.addToQueue(newItems);
    newItems.forEach(item => processUpload(item.id, item.file));
  }, [processUpload]);

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
      } catch (err) {
        notify.error(getErrorMessage(err), 'Delete Failed');
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
      } catch (err) {
        notify.error(getErrorMessage(err), 'Delete Failed');
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
    const toDeleteDb: string[] = [];

    allCards.forEach(card => {
      if (card.kind === 'draft') {
        toDeleteDb.push(card.result.id);
      } else {
        const item = store.uploadQueue.find(i => i.id === card.pipelineItem.id) ?? card.pipelineItem;
        revokeBlobUrl(item.previewUrl);
        if (isUploading(item.status)) {
          try { item.abortUpload?.(); } catch { /* abort errors expected */ }
        } else if (item.status === 'completed' && item.mediaId) {
          toDeleteDb.push(item.mediaId);
        } else if (isOrphanAsset(item)) {
          void deleteOrphanAsset({ publicId: item.cloudinaryResult.publicId, resourceType: item.cloudinaryResult.resource_type });
        }
      }
    });

    if (toDeleteDb.length > 0) {
      deleteMediaBatch({ ids: toDeleteDb });
    }

    store.clearQueue();
  }, [deleteMediaBatch, deleteOrphanAsset]);

  // ========================================================================
  // PUBLIC API
  // ========================================================================

  return {
    addFiles,
    remove,
    discardAll,
    retry,
  };
};

// ===========================================================================
// MODULE-LEVEL HELPERS
// ===========================================================================

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
