import { useMemo } from 'react';
import { useMyDrafts } from 'entities/Media';
import { useUploadStore } from 'features/Upload/model/uploadStore';
import { GalleryCard } from './types';
import { getPublishableMediaIds, getSelectableUploadCards, getUploadQueueStatus } from './uploadQueuePolicy';

/**
 * Merges server state (TanStack Query drafts) with client state (active Zustand uploads)
 * into a unified gallery-card view.
 *
 * Returns GalleryCard[] — a discriminated union that keeps pipeline items and
 * server-only drafts as distinct types, never conflated via synthetic defaults.
 */
export function useUploadQueue() {
  const { data: draftMedia = [] } = useMyDrafts();
  const uploadQueue = useUploadStore(state => state.uploadQueue);

  const activeUploads = useMemo(
    () => uploadQueue.filter(item => item.status !== 'cancelled'),
    [uploadQueue]
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

  const queueStatus = useMemo(() => getUploadQueueStatus(queue), [queue]);
  const selectableItems = useMemo(() => getSelectableUploadCards(queue), [queue]);
  const publishableMediaIds = useMemo(() => getPublishableMediaIds(queue), [queue]);

  return {
    queue,
    hasActiveUploads: queueStatus.hasActiveUploads,
    publishableMediaIds,
    queueStatus,
    selectableItems,
  };
}
