import { useCallback, useMemo, useState } from 'react';
import { usePublishMedia } from 'entities/Media/model/usePublishMedia';
import { notify } from 'shared/lib/notifications';
import { MIN_MEDIA_PRICE_CENTS, MEDIA_STATUS } from 'entities/Media/constants';
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
 *
 * publishingIds — set of mediaIds currently mid-publish (client-only).
 * Used by UploadCardRenderer to show per-card "Publishing…" overlay.
 */
export function usePublish(
  queue: QueueItem[],
  mutateDraftMedia: () => Promise<unknown>,
  selectedIds: readonly string[] | undefined,
  onSuccess?: (mediaIds: string[]) => void
) {
  const { mutateAsync: publishMedia } = usePublishMedia();
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishingIds, setPublishingIds] = useState<Set<string>>(new Set());

  const publishStats = useMemo((): PublishStats => {
    const completed = queue.filter(item => item.status === 'completed' && item.result);
    const target = selectedIds && selectedIds.length > 0
      ? completed.filter(item => selectedIds.includes(item.result!.id))
      : completed;

    const ready = target.filter(item => {
      const r = item.result!;
      // DRIVE_PENDING items have no Cloudinary resource yet — skip resource.url check.
      // The server handles Cloudinary import at publish time via publishDriveItem.
      const hasResource =
        r.status === MEDIA_STATUS.DRIVE_PENDING || !!r.resource.url;
      return (
        r.capturedAt &&
        r.price !== undefined &&
        r.price >= MIN_MEDIA_PRICE_CENTS &&
        hasResource &&
        r.spotId
      );
    });

    return {
      total: target.length,
      ready: ready.length,
      allReady: target.length > 0 && ready.length === target.length,
      mediaIds: ready.map(item => item.result!.id),
    };
  }, [queue, selectedIds]);

  const handlePublish = useCallback(async () => {
    if (publishStats.mediaIds.length === 0) return;

    const ids = publishStats.mediaIds;
    setIsPublishing(true);
    setPublishingIds(new Set(ids));
    try {
      const published = await publishMedia({ mediaIds: ids });
      notify.success(`Successfully published ${published.length} item(s)`, 'Published');
      void mutateDraftMedia();
      onSuccess?.(ids);
    } catch {
      // notification handled by usePublishMedia onError
    } finally {
      setIsPublishing(false);
      setPublishingIds(new Set());
    }
  }, [publishStats.mediaIds, mutateDraftMedia, publishMedia, onSuccess]);

  return { publishStats, isPublishing, publishingIds, handlePublish };
}
