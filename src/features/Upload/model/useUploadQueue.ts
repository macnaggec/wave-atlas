import { useMemo } from 'react';
import { MediaItem } from 'entities/Media';
import { useUploadStore } from 'features/Upload/model/uploadStore';
import { QueueItem } from './types';

/**
 * Merges server state (TanStack Query drafts) with client state (active Zustand uploads)
 * into a unified queue view for a specific spot.
 *
 * sessionId may be null in the deferred-session flow (upload before time entry).
 * In that case draftMedia will be [] and the queue is driven purely by Zustand.
 */
export function useUploadQueue(spotId: string, sessionId: string | null, draftMedia: MediaItem[]) {
  const uploadQueue = useUploadStore(state => state.uploadQueue);

  const activeUploads = useMemo(
    () => uploadQueue.filter(item => item.spotId === spotId),
    [uploadQueue, spotId]
  );

  const queue = useMemo(() => {
    const draftById = new Map(draftMedia.map(d => [d.id, d]));
    const activeMediaIds = new Set(
      activeUploads.filter(i => i.mediaId).map(i => i.mediaId!)
    );

    const activeQueueItems: QueueItem[] = activeUploads.map(item => ({
      ...item,
      result: item.mediaId ? draftById.get(item.mediaId) : undefined,
    }));

    const serverOnlyDrafts: QueueItem[] = draftMedia
      .filter(d => !activeMediaIds.has(d.id))
      .map(draft => ({
        id: draft.id,
        spotId: draft.spotId,
        sessionId,
        file: null,
        previewUrl: draft.lightboxUrl,
        status: 'completed' as const,
        progress: 100,
        mediaId: draft.id,
        result: draft,
      }));

    return [...serverOnlyDrafts, ...activeQueueItems];
  }, [draftMedia, activeUploads, sessionId]);

  const hasActiveUploads = activeUploads.some(
    item => item.status !== 'completed' && item.status !== 'error'
  );

  return { queue, hasActiveUploads };
}
