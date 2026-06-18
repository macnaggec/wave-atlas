import { useCallback, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { usePublishSession } from 'entities/SurfSession';
import { getErrorMessage } from 'shared/lib/getErrorMessage';
import { notify } from 'shared/lib/notifications';
import { useTRPC } from 'shared/lib/trpc';
import { combineDateAndTime, minutesToTime } from '../ui/steps/helpers';
import type { GalleryCard } from './types';
import { useClearUploadQueue } from './useClearUploadQueue';
import { getPublishableMediaIds, getUploadQueueStatus } from './uploadQueuePolicy';

type PublishSpot = {
  id: string;
} | null;

export type UsePublishUploadSessionOptions = {
  spot: PublishSpot;
  queue: GalleryCard[];
  sessionDate: Date | null;
  sessionRange: [number, number];
  photoPrice: number;
  videoPrice: number;
  onCancel: () => void;
  onPublishFailed?: () => void;
};

export function usePublishUploadSession({
  spot,
  queue,
  sessionDate,
  sessionRange,
  photoPrice,
  videoPrice,
  onCancel,
  onPublishFailed,
}: UsePublishUploadSessionOptions) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const clearQueue = useClearUploadQueue();
  const { mutateAsync: createAndPublish, isPending } = usePublishSession();
  const [hasTriedPublish, setHasTriedPublish] = useState(false);
  const [filesErrorTick, setFilesErrorTick] = useState(0);
  const queueStatus = useMemo(() => getUploadQueueStatus(queue), [queue]);
  const mediaIds = useMemo(() => getPublishableMediaIds(queue), [queue]);

  const canPublish = useMemo(
    () => !!spot && queueStatus.canContinue && !!sessionDate && sessionRange[0] < sessionRange[1],
    [spot, queueStatus.canContinue, sessionDate, sessionRange],
  );

  const publish = useCallback(async () => {
    if (!canPublish) {
      setHasTriedPublish(true);
      if (!spot) onPublishFailed?.();
      if (mediaIds.length === 0 || !queueStatus.canContinue) setFilesErrorTick((tick) => tick + 1);
      return;
    }

    const startsAt = combineDateAndTime(sessionDate!, minutesToTime(sessionRange[0]));
    const endsAt = combineDateAndTime(sessionDate!, minutesToTime(sessionRange[1]));

    try {
      await createAndPublish({
        spotId: spot!.id,
        startsAt,
        endsAt,
        mediaIds,
        photoPrice,
        videoPrice,
      });
    } catch (err) {
      notify.error(getErrorMessage(err), 'Publish Failed');
      return;
    }

    void queryClient.invalidateQueries({ queryKey: trpc.users.myDraftCounts.queryKey() });
    void queryClient.invalidateQueries({ queryKey: trpc.media.myDrafts.queryKey() });
    void queryClient.invalidateQueries({ queryKey: trpc.users.myUploads.queryKey() });
    clearQueue();
    onCancel();
  }, [
    canPublish,
    spot,
    onPublishFailed,
    mediaIds,
    queueStatus.canContinue,
    sessionDate,
    sessionRange,
    createAndPublish,
    photoPrice,
    videoPrice,
    queryClient,
    trpc,
    clearQueue,
    onCancel,
  ]);

  return {
    canPublish,
    filesErrorTick,
    hasTriedPublish,
    isPending,
    publish,
  };
}
