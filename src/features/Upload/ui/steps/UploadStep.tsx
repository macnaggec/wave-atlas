import { useState, useEffect, useRef } from 'react';
import { useUploadManager, useUploadQueue, useUploadWarning, GalleryCard, getItemId } from '../../model';
import { useGooglePicker } from '../../model/useGooglePicker';
import { useGallerySelection } from 'shared/hooks/gallery';
import { StepModeModal } from '../UploadGallery/StepModeModal';
import { UploadStatusLabel } from '../UploadGallery/UploadStatusLabel';
import { UploadZone } from '../UploadGallery/UploadZone';

export function UploadStep({ draftId, filesErrorTick }: { draftId: string; filesErrorTick?: number }) {
  const { queue, hasActiveUploads, selectableItems } = useUploadQueue(draftId);
  useUploadWarning(hasActiveUploads);

  const { addFiles, addDriveSelections, remove, retry, discardAll } = useUploadManager(draftId);

  const { trigger: openDrivePicker, isPickerLoading } = useGooglePicker(
    async (selections) => addDriveSelections(selections),
  );

  const selection = useGallerySelection<GalleryCard>({ items: selectableItems, getId: getItemId });

  // -------------------------------------------------------------------------
  // Modal open state + auto-open/close
  // -------------------------------------------------------------------------

  const [isModalOpen, setIsModalOpen] = useState(false);

  const prevQueueLengthRef = useRef(queue.length);
  useEffect(() => {
    const prev = prevQueueLengthRef.current;
    prevQueueLengthRef.current = queue.length;
    if (queue.length > 0 && prev === 0) setIsModalOpen(true);
    else if (queue.length === 0 && prev > 0) setIsModalOpen(false);
  }, [queue.length]);

  // -------------------------------------------------------------------------
  // Flash on empty-queue publish attempt
  // -------------------------------------------------------------------------

  const [isFlashing, setIsFlashing] = useState(false);
  const prevTickRef = useRef(0);
  useEffect(() => {
    if (filesErrorTick && filesErrorTick !== prevTickRef.current && queue.length === 0) {
      prevTickRef.current = filesErrorTick;
      setIsFlashing(true);
    }
  }, [filesErrorTick, queue.length]);

  return (
    <>
      <UploadStatusLabel
        items={queue}
        hasActiveUploads={hasActiveUploads}
        onOpen={() => setIsModalOpen(true)}
      />
      {queue.length === 0 && (
        <UploadZone
          onFilesSelected={addFiles}
          onDriveImport={openDrivePicker}
          driveLoading={isPickerLoading}
          flashError={isFlashing}
          onFlashEnd={() => setIsFlashing(false)}
        />
      )}
      <StepModeModal
        opened={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        items={queue}
        onRemove={remove}
        onAddFiles={addFiles}
        onRetry={retry}
        selection={selection}
        onDiscardAll={discardAll}
      />
    </>
  );
}
