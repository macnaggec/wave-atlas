import { useState, useCallback, useMemo } from 'react';
import { Button, Center, Divider, Group, Stack, Text, Title } from '@mantine/core';
import { IconLogin2, IconPhoto, IconVideo } from '@tabler/icons-react';
import { useUser } from 'shared/hooks/useUser';
import { useAuthModal } from 'features/Auth/AuthModalProvider';
import { useUploadStore } from '../model/uploadStore';
import type { Spot } from 'entities/Spot/types';
import { SpotStep } from './steps/SpotStep';
import { UploadStep } from './steps/UploadStep';
import { TimeStep } from './steps/TimeStep';

// ─── Files pill ───────────────────────────────────────────────────────────────

function FilesPill({ spotId }: { spotId: string }) {
  const queue = useUploadStore((s) => s.uploadQueue);
  const { photoCount, videoCount } = useMemo(() => {
    const completed = queue.filter(
      (item) => item.spotId === spotId && item.status === 'completed'
    );
    const vc = completed.filter(
      (item) =>
        item.cloudinaryResult?.resource_type === 'video' ||
        item.file?.type.startsWith('video/')
    ).length;
    return { photoCount: completed.length - vc, videoCount: vc };
  }, [queue, spotId]);

  return (
    <>
      <Group px="md" py="xs" gap="xs">
        {photoCount > 0 && (
          <Group gap={4}>
            <IconPhoto size={14} style={{ color: 'rgba(255,255,255,0.65)' }} />
            <Text size="sm" fw={500} style={{ color: '#fff' }}>{photoCount}</Text>
          </Group>
        )}
        {videoCount > 0 && (
          <Group gap={4}>
            <IconVideo size={14} style={{ color: 'rgba(255,255,255,0.65)' }} />
            <Text size="sm" fw={500} style={{ color: '#fff' }}>{videoCount}</Text>
          </Group>
        )}
      </Group>
      <Divider />
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

export function UploadSidebar() {
  const { isAuthenticated, isLoading } = useUser();
  const clearQueue = useUploadStore((s) => s.clearQueue);

  const [spot, setSpot] = useState<Spot | null>(null);
  const [uploadConfirmed, setUploadConfirmed] = useState(false);

  const handleClearSpot = useCallback(() => {
    clearQueue();
    setSpot(null);
    setUploadConfirmed(false);
  }, [clearQueue]);

  if (isLoading) return null;
  if (!isAuthenticated) return <AuthGate />;

  return (
    <Stack gap={0}>
      {/* Step 1 — stays mounted; morphs between search bar and pill+X */}
      <SpotStep spot={spot} onSelect={setSpot} onClear={handleClearSpot} />

      {/* Step 2 */}
      {spot && (
        uploadConfirmed ? (
          <FilesPill spotId={spot.id} />
        ) : (
          <UploadStep
            spot={spot}
            onConfirm={() => setUploadConfirmed(true)}
          />
        )
      )}

      {/* Step 3 */}
      {uploadConfirmed && spot && (
        <TimeStep
          spot={spot}
          onPublished={handleClearSpot}
        />
      )}
    </Stack>
  );
}
