import { useCallback } from 'react';
import { useDeleteOrphanAsset } from 'entities/Media';
import { useUploadStore } from './uploadStore';

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

      if (item.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(item.previewUrl);

      if (['signing', 'uploading', 'saving'].includes(item.status)) {
        try { item.abortUpload?.(); } catch { /* abort errors expected */ }
      } else if (item.status === 'error' && item.cloudinaryResult && !item.mediaId) {
        void deleteOrphanAsset({ publicId: item.cloudinaryResult.publicId, resourceType: item.cloudinaryResult.resource_type });
      }
    });
    store.clearQueue();
  }, [deleteOrphanAsset]);
}
