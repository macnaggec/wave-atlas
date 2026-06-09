

import { useCallback } from 'react';
import { useUpdateBatchMedia } from 'entities/Media/model/useUpdateBatchMedia';
import { notify } from 'shared/lib/notifications';
import { QueueItem } from './types';

/**
 * Encapsulates bulk metadata editing for draft queue items.
 *
 * Responsibilities:
 * - Map queue item IDs → mediaIds (falls back to all completed if none selected)
 * - Call server mutation
 * - Show success/error notifications
 */
export function useDraftEditing(queue: QueueItem[]) {
  const { mutateAsync: updateBatch } = useUpdateBatchMedia();
  // selectedIds from useGallerySelection are keyed by getItemId = mediaId ?? id.
  // For completed items this equals mediaId, so selectedIds ARE the media IDs.
  // When nothing is selected, fall back to all completed items by mediaId.
  const getMediaIds = useCallback((selectedIds: string[]): string[] => {
    const targetIds = selectedIds.length > 0
      ? selectedIds
      : queue
        .filter(item => item.status === 'completed' && item.mediaId)
        .map(item => item.mediaId!);

    if (targetIds.length === 0) return [];

    const selectedSet = new Set(targetIds);
    return queue
      .filter(item => selectedSet.has(item.mediaId ?? item.id) && item.mediaId)
      .map(item => item.mediaId!);
  }, [queue]);

  const handleBulkPriceEdit = useCallback(async (
    selectedIds: string[],
    price: number
  ) => {
    const mediaIds = getMediaIds(selectedIds);
    if (mediaIds.length === 0) return;

    try {
      await updateBatch({ mediaIds, price: Math.round(price * 100) });
    } catch {
      // notification handled by useUpdateBatchMedia onError
    }
  }, [getMediaIds, updateBatch]);

  const handleBulkDateEdit = useCallback(async (
    selectedIds: string[],
    date: Date
  ) => {
    const mediaIds = getMediaIds(selectedIds);
    if (mediaIds.length === 0) return;

    try {
      await updateBatch({ mediaIds, capturedAt: date });
      notify.success(`Updated date for ${mediaIds.length} item(s)`, 'Date Updated');
    } catch {
      // notification handled by useUpdateBatchMedia onError
    }
  }, [getMediaIds, updateBatch]);

  return { handleBulkPriceEdit, handleBulkDateEdit };
}
