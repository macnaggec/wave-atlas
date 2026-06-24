import { useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Box, Button, Divider, Group, Stack } from '@mantine/core';
import { getErrorMessage } from 'shared/lib/getErrorMessage';
import { notify } from 'shared/lib/notifications';
import { usePublishUploadSession, useUploadQueue } from '../model';
import { useUpdateSurfSessionDraft, type SurfSessionDraft } from 'entities/SurfSession';
import { useTRPC } from 'shared/lib/trpc';
import { UploadStep } from './steps/UploadStep';
import { PriceStep } from './steps/PriceStep';
import { TimeStep } from './steps/TimeStep';
import { combineDateAndTime, minutesToTime } from './steps/helpers';

interface UploadSidebarProps {
  draft: SurfSessionDraft;
  onCancel: () => void;
  /** Called when publish is attempted but spot is not selected — lets the route highlight the spot field. */
  onPublishFailed?: () => void;
}

function dateToMinutes(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

export function UploadSidebar({ draft, onCancel, onPublishFailed }: UploadSidebarProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { mutateAsync: updateDraft } = useUpdateSurfSessionDraft();
  const [photoPrice, setPhotoPrice] = useState(draft.photoPrice);
  const [videoPrice, setVideoPrice] = useState(draft.videoPrice);
  const [sessionDate, setSessionDate] = useState<Date | null>(
    draft.startsAt ? new Date(draft.startsAt) : null,
  );
  const [sessionRange, setSessionRange] = useState<[number, number]>(() => (
    draft.startsAt && draft.endsAt
      ? [dateToMinutes(new Date(draft.startsAt)), dateToMinutes(new Date(draft.endsAt))]
      : [360, 600]
  ));
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());

  const { queue } = useUploadQueue(draft.id);

  const { canPublish, filesErrorTick, hasTriedPublish, isPending, publish } = usePublishUploadSession({
    draftId: draft.id,
    spot: draft.spot,
    queue,
    sessionDate,
    sessionRange,
    photoPrice,
    videoPrice,
    onCancel,
    onPublishFailed,
  });

  const saveDraft = useCallback((changes: {
    startsAt?: Date | null;
    endsAt?: Date | null;
    photoPrice?: number;
    videoPrice?: number;
  }) => {
    const save = saveQueueRef.current.then(async () => {
      try {
        await updateDraft({ draftId: draft.id, ...changes });
        await queryClient.invalidateQueries({ queryKey: trpc.sessions.draft.queryKey(draft.id) });
        return true;
      } catch (error) {
        notify.error(getErrorMessage(error), 'Draft Save Failed');
        return false;
      }
    });
    saveQueueRef.current = save.then(() => undefined);
    return save;
  }, [draft.id, queryClient, trpc, updateDraft]);

  const handleTimeChange = useCallback((date: Date | null, range: [number, number]) => {
    setSessionDate(date);
    setSessionRange(range);
  }, []);

  const handleTimeCommit = useCallback((date: Date | null, range: [number, number]) => {
    void saveDraft({
      startsAt: date ? combineDateAndTime(date, minutesToTime(range[0])) : null,
      endsAt: date ? combineDateAndTime(date, minutesToTime(range[1])) : null,
    });
  }, [saveDraft]);

  const handlePublish = useCallback(async () => {
    // Skip draft save when we know publish will be blocked — let publish() handle
    // the validation feedback (spot flash, files error tick) without a server round-trip.
    if (!canPublish) {
      await publish();
      return;
    }
    const saved = await saveDraft({
      startsAt: sessionDate ? combineDateAndTime(sessionDate, minutesToTime(sessionRange[0])) : null,
      endsAt: sessionDate ? combineDateAndTime(sessionDate, minutesToTime(sessionRange[1])) : null,
      photoPrice,
      videoPrice,
    });
    if (!saved) return;
    await publish();
  }, [canPublish, photoPrice, publish, saveDraft, sessionDate, sessionRange, videoPrice]);

  return (
    <Stack gap={0} style={{ flex: 1 }}>
      {/* Files */}
      <UploadStep draftId={draft.id} filesErrorTick={filesErrorTick} />

      <Divider style={{ borderColor: 'rgba(255,255,255,0.07)' }} />

      {/* Price */}
      <PriceStep
        hasTriedPublish={hasTriedPublish}
        photoPrice={photoPrice}
        videoPrice={videoPrice}
        onPhotoPriceChange={setPhotoPrice}
        onVideoPriceChange={setVideoPrice}
        onPhotoPriceCommit={(nextPhotoPrice) => { void saveDraft({ photoPrice: nextPhotoPrice }); }}
        onVideoPriceCommit={(nextVideoPrice) => { void saveDraft({ videoPrice: nextVideoPrice }); }}
      />

      <Divider style={{ borderColor: 'rgba(255,255,255,0.07)' }} />

      {/* Date / Time */}
      <TimeStep
        date={sessionDate}
        range={sessionRange}
        onChange={handleTimeChange}
        onCommit={handleTimeCommit}
        hasTriedPublish={hasTriedPublish}
      />

      {/* Publish footer */}
      <Box>
        <Divider style={{ borderColor: 'rgba(255,255,255,0.07)' }} />
        <Group px="md" py="lg" justify="center">
          <Button
            variant="transparent"
            radius="xl"
            loading={isPending}
            onClick={() => { void handlePublish(); }}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: 'rgba(255,255,255,0.9)',
            }}
          >
            Publish session
          </Button>
        </Group>
      </Box>

    </Stack>
  );
}
