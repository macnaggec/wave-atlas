import { useState, useCallback, useMemo } from 'react';
import { Box, Button, Center, Divider, Group, Stack, Text, Title } from '@mantine/core';
import { IconLogin2 } from '@tabler/icons-react';
import { useUser } from 'shared/hooks/useUser';
import { useAuthModal } from 'entities/Identity';
import { usePublishSession } from 'entities/SurfSession';
import { useUploadStore, useClearUploadQueue, useUploadQueue } from '../model';
import type { Spot } from 'entities/Spot';
import { UploadStep } from './steps/UploadStep';
import { PriceStep } from './steps/PriceStep';
import { TimeStep } from './steps/TimeStep';
import { combineDateAndTime, minutesToTime } from './steps/helpers';

function AuthGate() {
  const { open: openAuthModal } = useAuthModal();
  return (
    <Center mih={260}>
      <Stack gap="xs" align="center" ta="center">
        <Title order={4}>Sign in to upload</Title>
        <Text c="dimmed" maw={320}>
          Uploads are tied to your account so you can manage them later.
        </Text>
        <Button leftSection={<IconLogin2 size={16} />} onClick={openAuthModal}>
          Sign in
        </Button>
      </Stack>
    </Center>
  );
}

interface UploadSidebarProps {
  spot: Spot | null;
  onCancel: () => void;
  /** Called when publish is attempted but spot is not selected — lets the route highlight the spot field. */
  onPublishFailed?: () => void;
}

export function UploadSidebar({ spot, onCancel, onPublishFailed }: UploadSidebarProps) {
  const { isAuthenticated, isLoading } = useUser();
  const clearQueue = useClearUploadQueue();
  const photoPrice = useUploadStore((s) => s.photoPrice);
  const videoPrice = useUploadStore((s) => s.videoPrice);

  const { queue } = useUploadQueue();

  const [hasTriedPublish, setHasTriedPublish] = useState(false);
  const [filesErrorTick, setFilesErrorTick] = useState(0);
  const [sessionDate, setSessionDate] = useState<Date | null>(null);
  const [sessionRange, setSessionRange] = useState<[number, number]>([360, 600]);

  const mediaIds = useMemo(() => {
    return queue.flatMap(card => {
      if (card.kind === 'draft') return [card.id];
      if (card.kind === 'uploading' && card.pipelineItem.status === 'completed' && card.pipelineItem.mediaId)
        return [card.pipelineItem.mediaId];
      return [];
    });
  }, [queue]);

  const { mutateAsync: createAndPublish, isPending } = usePublishSession();

  const canPublish = !!spot && mediaIds.length > 0 && !!sessionDate && sessionRange[0] < sessionRange[1];

  const handleTimeChange = useCallback((date: Date | null, range: [number, number]) => {
    setSessionDate(date);
    setSessionRange(range);
  }, []);

  const handlePublish = useCallback(async () => {
    if (!canPublish) {
      setHasTriedPublish(true);
      if (!spot) onPublishFailed?.();
      if (mediaIds.length === 0) setFilesErrorTick(t => t + 1);
      return;
    }
    const startsAt = combineDateAndTime(sessionDate!, minutesToTime(sessionRange[0]));
    const endsAt = combineDateAndTime(sessionDate!, minutesToTime(sessionRange[1]));
    await createAndPublish({
      spotId: spot.id,
      startsAt,
      endsAt,
      mediaIds,
      photoPrice,
      videoPrice,
    });
    clearQueue();
    onCancel();
  }, [canPublish, spot, sessionDate, sessionRange, mediaIds, photoPrice, videoPrice, createAndPublish, clearQueue, onCancel, onPublishFailed]);

  if (isLoading) return null;
  if (!isAuthenticated) return <AuthGate />;

  return (
    <Stack gap={0} style={{ flex: 1 }}>
      {/* Files */}
      <UploadStep filesErrorTick={filesErrorTick} />

      <Divider style={{ borderColor: 'rgba(255,255,255,0.07)' }} />

      {/* Price */}
      <PriceStep hasTriedPublish={hasTriedPublish} />

      <Divider style={{ borderColor: 'rgba(255,255,255,0.07)' }} />

      {/* Date / Time */}
      <TimeStep onChange={handleTimeChange} hasTriedPublish={hasTriedPublish} />

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
