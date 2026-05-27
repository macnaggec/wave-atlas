import { Box, Stack, Text } from '@mantine/core';
import type { Spot } from 'entities/Spot/types';
import { useUploadStore } from '../../model/uploadStore';
import { UploadManager } from '../UploadManager';

interface UploadStepProps {
  spot: Spot;
  onConfirm: (count: number) => void;
}

export function UploadStep({ spot, onConfirm }: UploadStepProps) {
  const uploadQueue = useUploadStore((s) => s.uploadQueue);
  const hasFiles = uploadQueue.some((item) => item.spotId === spot.id);

  return (
    <Stack gap={0}>
      {!hasFiles && (
        <Box px="md" pt="md" pb="xs">
          <Text size="sm" fw={500} style={{ color: '#fff' }}>Select files</Text>
        </Box>
      )}

      <UploadManager
        spotId={spot.id}
        sessionId={null}
        spotName={spot.name}
        draftMedia={[]}
        showPublish={false}
        onProceed={onConfirm}
      />
    </Stack>
  );
}
