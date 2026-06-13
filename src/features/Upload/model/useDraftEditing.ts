import { useCallback } from 'react';
import { useUpdateBatchMedia } from 'entities/Media';
import { notify } from 'shared/lib/notifications';
import { GalleryCard, getMediaId } from './types';

/**
 * Encapsulates bulk metadata editing for draft gallery cards.
 *
 * Responsibilities:
 * - Map card IDs → mediaIds (falls back to all cards with a DB row if none selected)
 * - Call server mutation
 * - Show success/error notifications
 */
export function useDraftEditing(queue: GalleryCard[]) {
  const { mutateAsync: updateBatch } = useUpdateBatchMedia();

  // selectedIds from useGallerySelection are keyed by card.id = getItemId(card).
  // For cards with a DB row this equals the mediaId, so selectedIds ARE the media IDs.
  // When nothing is selected, fall back to all cards that have a DB row.
  const getMediaIds = useCallback((selectedIds: string[]): string[] => {
    const allMediaIds = queue
      .map(card => getMediaId(card))
      .filter((id): id is string => id !== undefined);

    const targetIds = selectedIds.length > 0 ? selectedIds : allMediaIds;
    if (targetIds.length === 0) return [];

    const selectedSet = new Set(targetIds);
    return allMediaIds.filter(id => selectedSet.has(id));
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
