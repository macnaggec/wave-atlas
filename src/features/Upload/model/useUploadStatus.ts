import { useUploadStore } from 'features/Upload/model/uploadStore';

/**
 * Global upload progress/status for UI indicators and popovers.
 *
 * Returns session-scoped counters and upload context — use this
 * for display components that show upload progress across the app.
 *
 * For per-spot blocking logic, use `useUploadBlocking(spotId)` instead.
 */
export interface UploadStatusState {
  /** Whether uploads are active */
  isBlocked: boolean;
  /** ID of the spot currently uploading (if any) */
  uploadingSpotId: string | null;
  /** Name of the spot currently uploading (if any) */
  uploadingSpotName: string | null;
  /** Number of completed uploads in session */
  completedCount: number;
  /** Total number of uploads in session */
  totalCount: number;
}

export function useUploadStatus(): UploadStatusState {
  const hasActiveUploads = useUploadStore(state =>
    state.uploadQueue.some(item => item.status !== 'completed' && item.status !== 'error')
  );
  const uploadingSpotId = useUploadStore(state => state.uploadingSpotId);
  const uploadingSpotName = useUploadStore(state => state.uploadingSpotName);
  const totalCount = useUploadStore(state => state.sessionTotal);
  const completedCount = useUploadStore(state => state.sessionCompleted);

  return {
    isBlocked: hasActiveUploads && uploadingSpotId !== null,
    uploadingSpotId,
    uploadingSpotName,
    completedCount,
    totalCount,
  };
}
