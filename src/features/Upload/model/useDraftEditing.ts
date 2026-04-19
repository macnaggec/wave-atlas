'use client';

import { useCallback } from 'react';
import { useUpdateBatchMedia } from 'entities/Media/model/useUpdateBatchMedia';
import { notify } from 'shared/lib/notifications';
import { QueueItem } from './types';

type UpdateDraftItemFn = (
  ids: string[],
  updates: { price?: number; capturedAt?: Date }
) => void;

/**
 * Encapsulates bulk metadata editing for draft queue items.
 *
 * Responsibilities:
 * - Map queue item IDs → mediaIds (falls back to all completed if none selected)
 * - Call server mutation
 * - Apply optimistic TanStack Query cache update via updateDraftItem
 * - Show success/error notifications
 *
 * @param queue - Current queue for mediaId resolution
 * @param updateDraftItem - TanStack Query cache patch (source of truth for completed-item result data)
 */
export function useDraftEditing(
  queue: QueueItem[],
  updateDraftItem: UpdateDraftItemFn
) {
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
      await updateBatch({ mediaIds, price });
      updateDraftItem(mediaIds, { price: Math.round(price * 100) });
      notify.success(`Updated price for ${mediaIds.length} item(s)`, 'Price Updated');
    } catch {
      // notification handled by useUpdateBatchMedia onError
    }
  }, [getMediaIds, updateDraftItem, updateBatch]);

  const handleBulkDateEdit = useCallback(async (
    selectedIds: string[],
    date: Date
  ) => {
    const mediaIds = getMediaIds(selectedIds);
    if (mediaIds.length === 0) return;

    try {
      await updateBatch({ mediaIds, capturedAt: date });
      updateDraftItem(mediaIds, { capturedAt: date });
      notify.success(`Updated date for ${mediaIds.length} item(s)`, 'Date Updated');
    } catch {
      // notification handled by useUpdateBatchMedia onError
    }
  }, [getMediaIds, updateDraftItem, updateBatch]);

  return { handleBulkPriceEdit, handleBulkDateEdit };
}
