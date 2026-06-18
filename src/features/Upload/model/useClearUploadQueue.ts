import { useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useUploadStore } from './uploadStore';
import { isUploading, revokeBlobUrl, isOrphanAsset } from './types';
import { useTRPC } from 'shared/lib/trpc';

/**
 * Post-publish queue cleanup: revokes blob URLs, aborts in-progress uploads,
 * and deletes orphaned Cloudinary assets (upload succeeded, DB write failed).
 * Does NOT delete published DB records — those were just successfully published.
 */
export function useClearUploadQueue() {
  const trpc = useTRPC();
  const { mutateAsync: deleteOrphanAsset } = useMutation(trpc.media.deleteOrphanAsset.mutationOptions());

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
