import { useState, useCallback } from 'react';
import {
  useUploadWarning,
  GalleryCard,
  getItemId,
  type UploadManagerHandlers,
} from '../../model';
import { useGooglePicker } from '../../model/useGooglePicker';
import { useGallerySelection } from 'shared/hooks/gallery';
import { StepModeModal } from '../UploadGallery/StepModeModal';
import { UploadStatusLabel } from '../UploadGallery/UploadStatusLabel';
import { UploadZone } from '../UploadGallery/UploadZone';

interface UploadStepProps extends Pick<
  UploadManagerHandlers,
  'addFiles' | 'addDriveSelections' | 'remove' | 'retry' | 'discardAll'
> {
  queue: GalleryCard[];
  hasActiveUploads: boolean;
  selectableItems: GalleryCard[];
}

export function UploadStep({
  queue,
  hasActiveUploads,
  selectableItems,
  addFiles,
  addDriveSelections,
  remove,
  retry,
  discardAll,
}: UploadStepProps) {
  useUploadWarning(hasActiveUploads);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const effectiveModalOpen = isModalOpen && queue.length > 0;

  const handleFilesSelected = useCallback((files: File[]) => {
    addFiles(files);
    setIsModalOpen(true);
  }, [addFiles]);

  const { trigger: openDrivePicker, isPickerLoading } = useGooglePicker(
    useCallback(async (selections) => {
      await addDriveSelections(selections);
      setIsModalOpen(true);
    }, [addDriveSelections]),
  );

  const selection = useGallerySelection<GalleryCard>({ items: selectableItems, getId: getItemId });

  return (
    <>
      {queue.length > 0 && (
        <UploadStatusLabel
          items={queue}
          hasActiveUploads={hasActiveUploads}
          onOpen={() => setIsModalOpen(true)}
        />
      )}
      {queue.length === 0 && (
        <UploadZone
          onFilesSelected={handleFilesSelected}
          onDriveImport={openDrivePicker}
          driveLoading={isPickerLoading}
        />
      )}
      <StepModeModal
        opened={effectiveModalOpen}
        onClose={() => setIsModalOpen(false)}
        items={queue}
        onRemove={remove}
        onAddFiles={handleFilesSelected}
        onRetry={retry}
        selection={selection}
        onDiscardAll={discardAll}
        onDriveImport={openDrivePicker}
        driveLoading={isPickerLoading}
      />
    </>
  );
}
