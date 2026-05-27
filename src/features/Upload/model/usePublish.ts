import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTRPC } from 'app/lib/trpc';
import { notify } from 'shared/lib/notifications';
import { getErrorMessage } from 'shared/lib/getErrorMessage';
import { MIN_MEDIA_PRICE_CENTS, MEDIA_STATUS } from 'entities/Media/constants';
import { QueueItem } from './types';

export interface PublishStats {
  total: number;
  ready: number;
  allReady: boolean;
}

/**
 * Orchestrates session publish: derives readiness from the queue,
 * calls sessions.publish, shows notifications.
 */
export function usePublish(
  sessionId: string | null,
  queue: QueueItem[],
  mutateDraftMedia: () => Promise<unknown>,
  onSuccess?: (mediaIds: string[]) => void
) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishingIds, setPublishingIds] = useState<Set<string>>(new Set());

  const { mutateAsync: publishSession } = useMutation(
    trpc.sessions.publish.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: trpc.sessions.list.queryKey() });
        void queryClient.invalidateQueries({ queryKey: trpc.sessions.mine.queryKey() });
      },
      onError: (err) => {
        notify.error(getErrorMessage(err), 'Publish Failed');
      },
    }),
  );

  const publishStats = useMemo((): PublishStats => {
    const completed = queue.filter(item => item.status === 'completed' && item.result);
    const ready = completed.filter(item => {
      const r = item.result!;
      const hasResource =
        r.status === MEDIA_STATUS.DRIVE_PENDING || !!r.resource.url;
      return (
        r.capturedAt &&
        r.price !== undefined &&
        r.price >= MIN_MEDIA_PRICE_CENTS &&
        hasResource
      );
    });
    return {
      total: completed.length,
      ready: ready.length,
      allReady: completed.length > 0 && ready.length === completed.length,
    };
  }, [queue]);

  const handlePublish = useCallback(async () => {
    if (!sessionId || !publishStats.allReady || publishStats.total === 0) return;

    const allMediaIds = queue
      .filter(item => item.status === 'completed' && item.mediaId)
      .map(item => item.mediaId!);

    setIsPublishing(true);
    setPublishingIds(new Set(allMediaIds));

    try {
      const result = await publishSession(sessionId);
      notify.success(`Successfully published ${result.mediaIds.length} item(s)`, 'Published');
      void mutateDraftMedia();
      onSuccess?.(result.mediaIds);
    } catch {
      // notification handled by mutation onError
    } finally {
      setIsPublishing(false);
      setPublishingIds(new Set());
    }
  }, [sessionId, publishStats, queue, mutateDraftMedia, publishSession, onSuccess]);

  return { publishStats, isPublishing, publishingIds, handlePublish };
}
