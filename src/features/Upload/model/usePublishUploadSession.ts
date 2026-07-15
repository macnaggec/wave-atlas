import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getErrorMessage } from 'shared/lib/getErrorMessage';
import { notify } from 'shared/lib/notifications';
import { useTRPC } from 'shared/lib/trpc';
import { MIN_MEDIA_PRICE_CENTS } from 'entities/Media';
import type { GalleryCard } from './types';
import { useClearUploadQueue } from './useClearUploadQueue';
import { getUploadQueueStatus } from './uploadQueuePolicy';

type PublishSpot = {
  id: string;
} | null;

export type UploadPublishViolation = 'spot' | 'media' | 'price' | 'time';

export type UsePublishUploadSessionOptions = {
  workspaceId: string | undefined;
  spot: PublishSpot;
  queue: GalleryCard[];
  sessionDate: Date | null;
  sessionRange: [number, number];
  photoPrice: number;
  videoPrice: number;
  onComplete: (sessionId: string) => void;
};

export function usePublishUploadSession({
  workspaceId,
  spot,
  queue,
  sessionDate,
  sessionRange,
  photoPrice,
  videoPrice,
  onComplete,
}: UsePublishUploadSessionOptions) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const clearQueue = useClearUploadQueue();
  const { mutateAsync: saveWorkspace, isPending } = useMutation(
    trpc.uploads.saveWorkspace.mutationOptions({
      onSuccess: async (result, variables) => {
        await Promise.all([
          queryClient.invalidateQueries(trpc.uploads.getActiveWorkspace.queryFilter()),
          queryClient.invalidateQueries(trpc.uploads.getWorkspaceState.queryFilter(variables)),
          queryClient.invalidateQueries(trpc.sessions.list.pathFilter()),
          queryClient.invalidateQueries(trpc.sessions.mine.queryFilter()),
          queryClient.invalidateQueries(trpc.sessions.byId.queryFilter(result.id)),
          queryClient.invalidateQueries(trpc.sessions.media.queryFilter(result.id)),
          queryClient.invalidateQueries(trpc.users.myDraftCounts.queryFilter()),
          queryClient.invalidateQueries(trpc.users.myUploads.queryFilter()),
          queryClient.invalidateQueries(trpc.media.myDrafts.queryFilter()),
        ]);
      },
    }),
  );
  const [hasTriedPublish, setHasTriedPublish] = useState(false);
  const queueStatus = useMemo(() => getUploadQueueStatus(queue), [queue]);

  const violations = useMemo(() => {
    const nextViolations: UploadPublishViolation[] = [];
    if (!spot) nextViolations.push('spot');
    if (!workspaceId || !queueStatus.canContinue) nextViolations.push('media');
    if (photoPrice < MIN_MEDIA_PRICE_CENTS || videoPrice < MIN_MEDIA_PRICE_CENTS) {
      nextViolations.push('price');
    }
    if (!sessionDate || sessionRange[0] >= sessionRange[1]) nextViolations.push('time');
    return nextViolations;
  }, [photoPrice, queueStatus.canContinue, sessionDate, sessionRange, spot, videoPrice, workspaceId]);

  const canPublish = violations.length === 0;

  const publish = useCallback(async () => {
    if (!canPublish || !workspaceId) {
      setHasTriedPublish(true);
      return;
    }

    let result;
    try {
      result = await saveWorkspace({ workspaceId });
    } catch (err) {
      notify.error(getErrorMessage(err), 'Save Failed');
      return;
    }

    clearQueue();
    onComplete(result.id);
  }, [
    canPublish,
    workspaceId,
    saveWorkspace,
    clearQueue,
    onComplete,
  ]);

  return {
    canPublish,
    hasTriedPublish,
    isPending,
    publish,
    violations,
  };
}
