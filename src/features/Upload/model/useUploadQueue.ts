import { useMemo } from 'react';
import { MediaItem } from 'entities/Media/types';
import { useUploadStore } from 'features/Upload/model/uploadStore';
import { QueueItem } from './types';

/**
 * DATA DERIVATION HOOK
 *
 * Merges server state (TanStack Query drafts) with client state (active Zustand uploads)
 * into a unified queue view for a specific spot.
 *
 * Architecture — single source of truth per concern:
 * - Zustand: upload-pipeline state (status, progress, error, mediaId)
 * - TanStack Query: MediaItem data (price, capturedAt, dateSource, resource)
 *
 * Merge strategy:
 * - Active uploads (Zustand): joined with TQ by mediaId to get result
 * - Server-only drafts (TQ only): prepended as synthetic completed items
 * - No duplication: activeMediaIds excludes server-only drafts
 *
 * @param spotId - Current spot identifier
 * @param draftMedia - Draft media from TanStack Query (source of truth for result data)
 */
export function useUploadQueue(spotId: string, draftMedia: MediaItem[]) {
  // ========================================================================
  // FILTER - Get active uploads for this spot
  // ========================================================================

  const uploadQueue = useUploadStore(state => state.uploadQueue);

  const activeUploads = useMemo(
    () => uploadQueue.filter(item => item.spotId === spotId),
    [uploadQueue, spotId]
  );

  // ========================================================================
  // MERGE - Join Zustand items with TQ data; prepend server-only drafts
  // ========================================================================

  const queue = useMemo(() => {
    const draftById = new Map(draftMedia.map(d => [d.id, d]));
    const activeMediaIds = new Set(
      activeUploads.filter(i => i.mediaId).map(i => i.mediaId!)
    );

    // Active uploads: join result from TQ by mediaId (undefined while uploading)
    const activeQueueItems: QueueItem[] = activeUploads.map(item => ({
      ...item,
      result: item.mediaId ? draftById.get(item.mediaId) : undefined,
    }));

    // Server-only drafts: exist in TQ but not in active uploads this session
    const serverOnlyDrafts: QueueItem[] = draftMedia
      .filter(d => !activeMediaIds.has(d.id))
      .map(draft => ({
        id: draft.id,
        spotId,
        file: null,
        previewUrl: draft.lightboxUrl,
        status: 'completed' as const,
        progress: 100,
        mediaId: draft.id,
        result: draft,
      }));

    return [...serverOnlyDrafts, ...activeQueueItems];
  }, [draftMedia, activeUploads, spotId]);

  // ========================================================================
  // DERIVE - Calculate additional flags
  // ========================================================================

  const hasActiveUploads = activeUploads.some(
    item => item.status !== 'completed' && item.status !== 'error'
  );

  return {
    queue,
    hasActiveUploads,
  };
}
