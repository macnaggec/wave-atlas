import { useMemo } from 'react';
import { useUploadManager, useUploadQueue, useUploadWarning, GalleryCard, getItemId } from '../../model';
import { useGooglePicker } from '../../model/useGooglePicker';
import { useGallerySelection } from 'shared/hooks/gallery';
import { StepModeModal } from '../UploadGallery/StepModeModal';

export function UploadStep({ filesErrorTick }: { filesErrorTick?: number }) {
  const { queue, hasActiveUploads } = useUploadQueue();
  useUploadWarning(hasActiveUploads);

  const { trigger: openDrivePicker, isPickerLoading } = useGooglePicker();

  const selectableItems = useMemo(
    () => queue.filter(card => card.kind === 'draft' || (card.kind === 'uploading' && card.pipelineItem.status === 'completed')),
    [queue]
  );
  const selection = useGallerySelection<GalleryCard>({ items: selectableItems, getId: getItemId });

  const { addFiles, remove, retry, discardAll } = useUploadManager();

  return (
    <StepModeModal
      items={queue}
      hasActiveUploads={hasActiveUploads}
      filesErrorTick={filesErrorTick}
      onRemove={remove}
      onAddFiles={addFiles}
      onDriveImport={openDrivePicker}
      driveLoading={isPickerLoading}
      onRetry={retry}
      selection={selection}
      onDiscardAll={discardAll}
    />
  );
}
