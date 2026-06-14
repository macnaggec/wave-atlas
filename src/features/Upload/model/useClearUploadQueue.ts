import { useCallback } from 'react';
import { useDeleteOrphanAsset } from 'entities/Media';
import { useUploadStore } from './uploadStore';
import { isUploading, revokeBlobUrl, isOrphanAsset } from './types';

/**
 * Post-publish queue cleanup: revokes blob URLs, aborts in-progress uploads,
 * and deletes orphaned Cloudinary assets (upload succeeded, DB write failed).
 * Does NOT delete published DB records — those were just successfully published.
 */
export function useClearUploadQueue() {
  const { mutateAsync: deleteOrphanAsset } = useDeleteOrphanAsset();

  return useCallback(() => {
    const store = useUploadStore.getState();
    store.uploadQueue.forEach(item => {
      if (item.status === 'importing') return;

      revokeBlobUrl(item.previewUrl);

      if (isUploading(item.status)) {
        try { item.abortUpload?.(); } catch { /* abort errors expected */ }
      } else if (isOrphanAsset(item)) {
        void deleteOrphanAsset({ publicId: item.cloudinaryResult.publicId, resourceType: item.cloudinaryResult.resource_type });
      }
    });
    store.clearQueue();
  }, [deleteOrphanAsset]);
}
