import { useCallback, useMemo, useState } from 'react';
import { usePublishMedia } from 'entities/Media/model/usePublishMedia';
import { notify } from 'shared/lib/notifications';
import { MIN_MEDIA_PRICE_CENTS } from 'entities/Media/constants';
import { QueueItem } from './types';

export interface PublishStats {
  total: number;
  ready: number;
  allReady: boolean;
  mediaIds: string[];
}

/**
 * Orchestrates the publish flow: derives readiness from the queue,
 * calls the publish mutation, shows notifications, and delegates cache
 * invalidation and cleanup to the caller.
 */
export function usePublish(
  queue: QueueItem[],
  mutateDraftMedia: () => Promise<unknown>,
  selectedIds: readonly string[] | undefined,
  onSuccess?: (mediaIds: string[]) => void
) {
  const { mutateAsync: publishMedia } = usePublishMedia();
  const [isPublishing, setIsPublishing] = useState(false);

  const publishStats = useMemo((): PublishStats => {
    const completed = queue.filter(item => item.status === 'completed' && item.result);
    const target = selectedIds && selectedIds.length > 0
      ? completed.filter(item => selectedIds.includes(item.result!.id))
      : completed;
    const ready = target.filter(item =>
      item.result?.capturedAt &&
      item.result?.price !== undefined &&
      item.result?.price >= MIN_MEDIA_PRICE_CENTS &&
      item.result?.resource.url &&
      item.result?.spotId
    );
    return {
      total: target.length,
      ready: ready.length,
      allReady: target.length > 0 && ready.length === target.length,
      mediaIds: ready.map(item => item.result!.id),
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
