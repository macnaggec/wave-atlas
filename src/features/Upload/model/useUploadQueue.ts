import { useMemo } from 'react';
import { useSessionlessDrafts } from 'entities/Media';
import { useUploadStore } from 'features/Upload/model/uploadStore';
import { GalleryCard } from './types';

/**
 * Merges server state (TanStack Query drafts) with client state (active Zustand uploads)
 * into a unified gallery-card view for a specific spot.
 *
 * sessionId may be null in the deferred-session flow (upload before time entry).
 * In that case draftMedia will be [] and the queue is driven purely by Zustand.
 *
 * Returns GalleryCard[] — a discriminated union that keeps pipeline items and
 * server-only drafts as distinct types, never conflated via synthetic defaults.
 */
export function useUploadQueue(spotId: string, sessionId: string | null) {
  const { data: draftMedia = [] } = useSessionlessDrafts(spotId, { enabled: sessionId === null });
  const uploadQueue = useUploadStore(state => state.uploadQueue);

  const activeUploads = useMemo(
    () => uploadQueue.filter(item => item.spotId === spotId && item.status !== 'cancelled'),
    [uploadQueue, spotId]
  );

  const queue = useMemo((): GalleryCard[] => {
    const draftById = new Map(draftMedia.map(d => [d.id, d]));
    const activeMediaIds = new Set(
      activeUploads.filter(i => i.mediaId).map(i => i.mediaId!)
    );

    const activeCards: GalleryCard[] = activeUploads.map(item => ({
      kind: 'uploading',
      id: item.mediaId ?? item.id,
      pipelineItem: item,
      result: item.mediaId ? draftById.get(item.mediaId) : undefined,
    }));

    const draftCards: GalleryCard[] = draftMedia
      .filter(d => !activeMediaIds.has(d.id))
      .map(draft => ({
        kind: 'draft',
        id: draft.id,
        result: draft,
      }));

    return [...draftCards, ...activeCards];
  }, [draftMedia, activeUploads]);

  const hasActiveUploads = activeUploads.some(
    item => item.status !== 'completed' && item.status !== 'error'
  );

  return { queue, hasActiveUploads };
}
