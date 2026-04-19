'use client';

import { useCallback, useMemo, useState } from 'react';
import { usePublishMedia } from 'entities/Media/model/usePublishMedia';
import { notify } from 'shared/lib/notifications';
import { QueueItem } from './types';

export interface PublishStats {
  total: number;
  ready: number;
  allReady: boolean;
  mediaIds: string[];
}

/**
 * Encapsulates the full publish workflow for a spot's draft queue.
 *
 * Responsibilities:
 * - Derive publish readiness from the queue
 * - Call the publish server action
 * - Show success/error notifications
 * - Invalidate SWR draft cache via mutateDraftMedia (passed by caller)
 * - Trigger RSC refresh so gallery receives fresh spotMedia
 * - Delegate queue cleanup to caller via onSuccess
 *
 * @param queue - Current upload queue to derive readiness from
 * @param mutateDraftMedia - SWR mutate fn scoped to this spot; provided by caller to avoid peer hook coupling
 * @param selectedIds - When non-empty, scopes publish stats and action to only the selected items
 * @param onSuccess - Called with published mediaIds after all side effects complete
 */
export function usePublish(
  queue: QueueItem[],
  mutateDraftMedia: () => Promise<unknown>,
  selectedIds: readonly string[] | undefined,
  onSuccess?: (mediaIds: string[]) => void
) {
  const { mutateAsync: publishMedia } = usePublishMedia();
  const [isPublishing, setIsPublishing] = useState(false);

  const publishStats: PublishStats = useMemo(() => {
    const completedItems = queue.filter(item => item.status === 'completed' && item.result);
    const targetItems = selectedIds && selectedIds.length > 0
      ? completedItems.filter(item => selectedIds.includes(item.result!.id))
      : completedItems;
    const readyItems = targetItems.filter(item =>
      item.result?.capturedAt &&
      item.result?.price !== undefined &&
      item.result?.price >= 0 &&
      item.result?.resource.url &&
      item.result?.spotId
    );
    return {
      total: targetItems.length,
      ready: readyItems.length,
      allReady: targetItems.length > 0 && readyItems.length === targetItems.length,
      mediaIds: readyItems.map(item => item.result!.id),
    };
  }, [queue, selectedIds]);

  const handlePublish = useCallback(async () => {
    if (publishStats.mediaIds.length === 0) return;

    setIsPublishing(true);
    try {
      const published = await publishMedia({ mediaIds: publishStats.mediaIds });
      notify.success(`Successfully published ${published.length} item(s)`, 'Published');
      void mutateDraftMedia();
      onSuccess?.(publishStats.mediaIds);
    } catch {
      // notification handled by usePublishMedia onError
    } finally {
      setIsPublishing(false);
    }
  }, [publishStats.mediaIds, mutateDraftMedia, publishMedia, onSuccess]);

  return { publishStats, isPublishing, handlePublish };
}
