import { useEffect, useRef, useMemo } from 'react';
import { useUploadManager, useUploadQueue, useDraftEditing, useUploadWarning, GalleryCard, getItemId } from '../model';
import { useGooglePicker } from '../model/useGooglePicker';
import { useGallerySelection } from 'shared/hooks/gallery';
import StepModeModal from './UploadGallery/StepModeModal';

export interface UploadManagerProps {
  spotId: string;
  sessionId: string | null;
  onQueueChange?: (count: number) => void;
  onProceed: (count: number) => void;
  /** Called when the user cancels all uploads and wants to start over. */
  onCancelAll?: () => void;
  hideZone?: boolean;
  externalModalOpen?: boolean;
  onModalOpenChange?: (open: boolean) => void;
  onPricesChange?: (photoPrice?: number, videoPrice?: number) => void;
}

export function UploadManager({
  spotId,
  sessionId,
  onQueueChange,
  onProceed,
  onCancelAll,
  hideZone,
  externalModalOpen,
  onModalOpenChange,
  onPricesChange,
}: UploadManagerProps) {
  const { queue, hasActiveUploads } = useUploadQueue(spotId, sessionId);
  useUploadWarning(hasActiveUploads);

  const { trigger: openDrivePicker, isPickerLoading } = useGooglePicker(spotId, sessionId);

  // Stable ref so effect deps don't change when caller passes an inline function
  const onQueueChangeRef = useRef(onQueueChange);
  useEffect(() => { onQueueChangeRef.current = onQueueChange; });
  useEffect(() => {
    onQueueChangeRef.current?.(queue.length);
  }, [queue.length]);

  // Only completed cards are selectable — error cards can't be price/date edited
  const selectableItems = useMemo(
    () => queue.filter(card => card.kind === 'draft' || (card.kind === 'uploading' && card.pipelineItem.status === 'completed')),
    [queue]
  );
  const selection = useGallerySelection<GalleryCard>({ items: selectableItems, getId: getItemId });

  const { addFiles, remove, retry, discardAll } = useUploadManager(spotId, sessionId);

  const { handleBulkPriceEdit } = useDraftEditing(queue);

  return (
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
      onProceed={onProceed}
      onDiscardAll={discardAll}
      onCancelAll={onCancelAll}
      hideZone={hideZone}
      externalModalOpen={externalModalOpen}
      onModalOpenChange={onModalOpenChange}
      onPricesChange={onPricesChange}
    />
  );
}
