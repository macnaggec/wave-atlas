import { Box, Stack, Text } from '@mantine/core';
import type { Spot } from 'entities/Spot';
import { useUploadStore } from '../../model/uploadStore';
import { UploadManager } from '../UploadManager';

interface UploadStepProps {
  spot: Spot;
  onConfirm: (count: number) => void;
  onCancel?: () => void;
  hideZone?: boolean;
  externalModalOpen?: boolean;
  onModalOpenChange?: (open: boolean) => void;
  onPricesChange?: (photoPrice?: number, videoPrice?: number) => void;
}

export function UploadStep({ spot, onConfirm, onCancel, hideZone, externalModalOpen, onModalOpenChange, onPricesChange }: UploadStepProps) {
  const uploadQueue = useUploadStore((s) => s.uploadQueue);
  const hasFiles = uploadQueue.some((item) => item.spotId === spot.id);

  return (
    <Stack gap={0}>
      {!hasFiles && !hideZone && (
        <Box px="md" pt="md" pb="xs">
          <Text size="xs" fw={500} style={{ letterSpacing: '0.07em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)' }}>Select files</Text>
        </Box>
      )}

      <UploadManager
        spotId={spot.id}
        sessionId={null}
        onProceed={onConfirm}
        onCancelAll={onCancel}
        hideZone={hideZone}
        externalModalOpen={externalModalOpen}
        onModalOpenChange={onModalOpenChange}
        onPricesChange={onPricesChange}
      />
    </Stack>
  );
}
