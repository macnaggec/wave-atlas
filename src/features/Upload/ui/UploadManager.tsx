import { useCallback, useEffect, useRef, useMemo } from 'react';
import { useUploadManager, useUploadQueue, useDraftEditing, useUploadWarning, QueueItem, UploadItemAction } from '../model';
import { useGooglePicker } from '../model/useGooglePicker';
import { useGallerySelection } from 'shared/hooks/gallery';
import UploadGallery from './UploadGallery/UploadGallery';
import { useSessionlessDrafts } from 'entities/Media';

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
  const { data: sessionlessDrafts = [] } = useSessionlessDrafts(spotId, { enabled: sessionId === null });
  const { queue, hasActiveUploads } = useUploadQueue(spotId, sessionId, sessionlessDrafts);
  useUploadWarning(hasActiveUploads);

  const { trigger: openDrivePicker, isPickerLoading } = useGooglePicker(spotId, sessionId);

  // Stable ref so effect deps don't change when caller passes an inline function
  const onQueueChangeRef = useRef(onQueueChange);
  useEffect(() => { onQueueChangeRef.current = onQueueChange; });
  useEffect(() => {
    onQueueChangeRef.current?.(queue.length);
  }, [queue.length]);

  const getItemId = useCallback((item: QueueItem) => item.mediaId ?? item.id, []);
  // Only completed items are selectable — error items can't be price/date edited
  const selectableItems = useMemo(
    () => queue.filter((item) => item.status === 'completed'),
    [queue]
  );
  const selection = useGallerySelection({ items: selectableItems, getId: getItemId });

  const { addFiles, remove, retry, discardAll } = useUploadManager(spotId, sessionId);

  const { handleBulkPriceEdit } = useDraftEditing(queue);
  const handleAction = useCallback((_action: UploadItemAction, itemId: string) => void remove(itemId), [remove]);

  return (
    <UploadGallery
      items={queue}
      hasActiveUploads={hasActiveUploads}
      onRemove={remove}
      onAddFiles={addFiles}
      onDriveImport={openDrivePicker}
      driveLoading={isPickerLoading}
      onRetry={retry}
      onBulkPriceEdit={handleBulkPriceEdit}
      onAction={handleAction}
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
