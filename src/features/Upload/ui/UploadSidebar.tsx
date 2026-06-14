import { useState, useCallback, useMemo } from 'react';
import { Box, Button, Center, Divider, Group, Stack, Text, Title } from '@mantine/core';
import { IconChevronRight, IconLogin2, IconPhoto, IconVideo } from '@tabler/icons-react';
import { useUser } from 'shared/hooks/useUser';
import { useAuthModal } from 'entities/Identity';
import { usePublishSession } from 'entities/SurfSession';
import { useUploadStore, useClearUploadQueue } from '../model';
import type { Spot } from 'entities/Spot';
import { UploadStep } from './steps/UploadStep';
import { TimeStep } from './steps/TimeStep';
import { combineDateAndTime, minutesToTime } from './steps/helpers';

// ─── Files pill ───────────────────────────────────────────────────────────────

interface FilesPillProps {
  spotId: string;
  onOpen: () => void;
  photoPrice: number | null;
  videoPrice: number | null;
}

function FilesPill({ spotId, onOpen, photoPrice, videoPrice }: FilesPillProps) {
  const queue = useUploadStore((s) => s.uploadQueue);
  const [hovered, setHovered] = useState(false);

  const { photoCount, videoCount } = useMemo(() => {
    const completed = queue.filter(
      (i) => i.spotId === spotId && i.status === 'completed',
    );
    const vc = completed.filter(
      (i) =>
        i.cloudinaryResult?.resource_type === 'video' ||
        i.file?.type.startsWith('video/'),
    ).length;
    return { photoCount: completed.length - vc, videoCount: vc };
  }, [queue, spotId]);

  const fmt = (p: number | null) => (p !== null && p > 0 ? `$${p.toFixed(0)}` : 'free');

  return (
    <>
      <Group px="md" py="md" gap="xs" justify="space-between" onClick={onOpen} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} style={{ cursor: 'pointer' }}>
        <Group gap="md">
          {photoCount > 0 && (
            <Group gap={4}>
              <IconPhoto size={13} style={{ color: 'rgba(255,255,255,0.55)' }} />
              <Text size="sm" fw={500} c="white">{photoCount}</Text>
              <Text size="xs" style={{ color: 'rgba(255,255,255,0.35)' }}>·</Text>
              <Text size="xs" style={{ color: 'rgba(255,255,255,0.45)' }}>{fmt(photoPrice)}</Text>
            </Group>
          )}
          {videoCount > 0 && (
            <Group gap={4}>
              <IconVideo size={13} style={{ color: 'rgba(255,255,255,0.55)' }} />
              <Text size="sm" fw={500} c="white">{videoCount}</Text>
              <Text size="xs" style={{ color: 'rgba(255,255,255,0.35)' }}>·</Text>
              <Text size="xs" style={{ color: 'rgba(255,255,255,0.45)' }}>{fmt(videoPrice)}</Text>
            </Group>
          )}
        </Group>
        <IconChevronRight size={13} style={{ color: hovered ? 'rgba(255,255,255,0.82)' : 'rgba(255,255,255,0.6)', transition: 'color 150ms ease' }} />
      </Group>
      <Divider style={{ borderColor: 'rgba(255,255,255,0.07)' }} />
    </>
  );
}

// ─── Auth gate ────────────────────────────────────────────────────────────────

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

// ─── Root ─────────────────────────────────────────────────────────────────────

export function UploadSidebar({ spot, onCancel }: { spot: Spot; onCancel: () => void }) {
  const { isAuthenticated, isLoading } = useUser();
  const clearQueue = useClearUploadQueue();
  const uploadQueue = useUploadStore((s) => s.uploadQueue);
  const wizardStep = useUploadStore((s) => s.wizardStep);
  const setWizardStep = useUploadStore((s) => s.setWizardStep);

  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [photoPrice, setPhotoPrice] = useState<number | null>(3);
  const [videoPrice, setVideoPrice] = useState<number | null>(3);
  const [sessionDate, setSessionDate] = useState<Date | null>(null);
  const [sessionRange, setSessionRange] = useState<[number, number]>([360, 600]);

  const mediaIds = useMemo(() => {
    return uploadQueue
      .filter((item) => item.spotId === spot.id && item.status === 'completed' && item.mediaId)
      .map((item) => item.mediaId!);
  }, [uploadQueue, spot.id]);

  const { mutateAsync: createAndPublish, isPending } = usePublishSession();

  const canPublish = wizardStep === 'time' && !!sessionDate && sessionRange[0] < sessionRange[1];

  const handleUploadConfirm = useCallback(() => setWizardStep('time'), [setWizardStep]);

  const handlePricesChange = useCallback((pp?: number, vp?: number) => {
    if (pp !== undefined) setPhotoPrice(pp);
    if (vp !== undefined) setVideoPrice(vp);
  }, []);

  const handleClearSpot = useCallback(() => {
    clearQueue();
    setUploadModalOpen(false);
    setPhotoPrice(3);
    setVideoPrice(3);
    setSessionDate(null);
    setSessionRange([360, 600]);
  }, [clearQueue]);

  const handleCancelUpload = useCallback(() => {
    setWizardStep('files');
    setUploadModalOpen(false);
    setPhotoPrice(3);
    setVideoPrice(3);
  }, []);

  const handleTimeChange = useCallback((date: Date | null, range: [number, number]) => {
    setSessionDate(date);
    setSessionRange(range);
  }, []);

  const handlePublish = useCallback(async () => {
    if (!sessionDate) return;
    const startsAt = combineDateAndTime(sessionDate, minutesToTime(sessionRange[0]));
    const endsAt = combineDateAndTime(sessionDate, minutesToTime(sessionRange[1]));
    await createAndPublish({ spotId: spot.id, startsAt, endsAt, mediaIds });
    handleClearSpot();
    onCancel();
  }, [sessionDate, sessionRange, spot.id, mediaIds, createAndPublish, handleClearSpot, onCancel]);

  if (isLoading) return null;
  if (!isAuthenticated) return <AuthGate />;

  return (
    <Stack gap={0} style={{ flex: 1 }}>
      {/* File selection */}
      {wizardStep === 'time' && (
        <FilesPill
          spotId={spot.id}
          onOpen={() => setUploadModalOpen(true)}
          photoPrice={photoPrice}
          videoPrice={videoPrice}
        />
      )}
      <UploadStep
        spot={spot}
        onConfirm={handleUploadConfirm}
        onCancel={handleCancelUpload}
        hideZone={wizardStep === 'time'}
        externalModalOpen={wizardStep === 'time' ? uploadModalOpen : undefined}
        onModalOpenChange={wizardStep === 'time' ? setUploadModalOpen : undefined}
        onPricesChange={handlePricesChange}
      />

      {/* Time */}
      {wizardStep === 'time' && (
        <TimeStep spot={spot} onChange={handleTimeChange} />
      )}

      {/* Publish footer */}
      {wizardStep === 'time' && (
        <Box>
          <Divider style={{ borderColor: 'rgba(255,255,255,0.07)' }} />
          <Group px="md" py="lg" justify="center">
            <Button
              variant="transparent"
              radius="xl"
              disabled={!canPublish}
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
      )}

      {/* Cancel */}
      <Group px="md" py="md" justify="center" style={{ marginTop: 'auto' }}>
        <button
          onClick={onCancel}
          style={{
            background: 'none',
            border: 'none',
            color: '#ffaade',
            fontSize: 14,
            fontWeight: 500,
            cursor: 'pointer',
            padding: '4px 8px',
            textShadow: '0 0 8px rgba(255,170,222,1), 0 0 24px rgba(255,120,200,0.7)',
          }}
        >
          Close
        </button>
      </Group>
    </Stack>
  );
}
