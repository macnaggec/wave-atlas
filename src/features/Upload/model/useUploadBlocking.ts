import { useUploadStore } from 'features/Upload/model/uploadStore';

/**
 * UPLOAD BLOCKING HOOK
 *
 * Determines if the current spot is blocked from uploading because
 * another spot has active uploads in progress.
 *
 * Business Rule:
 * Only one spot can have active uploads at a time to prevent
 * confusion about which spot files are being uploaded to.
 *
 * @param currentSpotId - The spot ID being managed
 * @returns Block status and blocking spot name if blocked
 */
export function useUploadBlocking(currentSpotId: string) {
  const uploadingSpotId = useUploadStore(state => state.uploadingSpotId);
  const uploadingSpotName = useUploadStore(state => state.uploadingSpotName);

  const globalHasActiveUploads = useUploadStore(state =>
    state.uploadQueue.some(item => item.status !== 'completed' && item.status !== 'error')
  );

  const isBlocked = globalHasActiveUploads && uploadingSpotId !== currentSpotId;

  return {
    isBlocked,
    blockingSpotName: isBlocked ? uploadingSpotName : null,
  };
}
