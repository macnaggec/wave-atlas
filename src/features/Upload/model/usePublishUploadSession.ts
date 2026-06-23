import { useCallback, useMemo, useState } from 'react';
import { usePublishSession } from 'entities/SurfSession';
import { getErrorMessage } from 'shared/lib/getErrorMessage';
import { notify } from 'shared/lib/notifications';
import type { GalleryCard } from './types';
import { useClearUploadQueue } from './useClearUploadQueue';
import { getPublishableMediaIds, getUploadQueueStatus } from './uploadQueuePolicy';

type PublishSpot = {
  id: string;
} | null;

export type UsePublishUploadSessionOptions = {
  draftId: string;
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
  draftId,
  spot,
  queue,
  sessionDate,
  sessionRange,
  onCancel,
  onPublishFailed,
}: UsePublishUploadSessionOptions) {
  const clearQueue = useClearUploadQueue();
  const { mutateAsync: publishDraft, isPending } = usePublishSession();
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

    try {
      await publishDraft(draftId);
    } catch (err) {
      notify.error(getErrorMessage(err), 'Publish Failed');
      return;
    }

    clearQueue();
    onCancel();
  }, [
    canPublish,
    draftId,
    spot,
    onPublishFailed,
    mediaIds,
    queueStatus.canContinue,
    publishDraft,
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
