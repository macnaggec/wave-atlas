import { useMemo } from 'react';
import { Box, Stack, Text } from '@mantine/core';
import type { Spot } from 'entities/Spot';
import { useUploadManager, useUploadQueue, useDraftEditing, useUploadWarning, GalleryCard, getItemId } from '../../model';
import { useGooglePicker } from '../../model/useGooglePicker';
import { useGallerySelection } from 'shared/hooks/gallery';
import { useUploadStore } from '../../model';
import StepModeModal from '../UploadGallery/StepModeModal';

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

  const { queue, hasActiveUploads } = useUploadQueue(spot.id, null);
  useUploadWarning(hasActiveUploads);

  const { trigger: openDrivePicker, isPickerLoading } = useGooglePicker(spot.id, null);

  const selectableItems = useMemo(
    () => queue.filter(card => card.kind === 'draft' || (card.kind === 'uploading' && card.pipelineItem.status === 'completed')),
    [queue]
  );
  const selection = useGallerySelection<GalleryCard>({ items: selectableItems, getId: getItemId });

  const { addFiles, remove, retry, discardAll } = useUploadManager(spot.id, null);

  const { handleBulkPriceEdit } = useDraftEditing(queue);

  return (
    <Stack gap={0}>
      {!hasFiles && !hideZone && (
        <Box px="md" pt="md" pb="xs">
          <Text size="xs" fw={500} style={{ letterSpacing: '0.07em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)' }}>Select files</Text>
        </Box>
      )}

      <StepModeModal
        items={queue}
        hasActiveUploads={hasActiveUploads}
        onRemove={remove}
        onAddFiles={addFiles}
        onDriveImport={openDrivePicker}
        driveLoading={isPickerLoading}
        onRetry={retry}
        onBulkPriceEdit={handleBulkPriceEdit}
        selection={selection}
        onProceed={onConfirm}
        onDiscardAll={discardAll}
        onCancelAll={onCancel}
        hideZone={hideZone}
        externalModalOpen={externalModalOpen}
        onModalOpenChange={onModalOpenChange}
        onPricesChange={onPricesChange}
      />
    </Stack>
  );
}
