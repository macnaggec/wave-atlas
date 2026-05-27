import { useCallback, useEffect, useRef, useMemo } from 'react';
import { MediaItem } from 'entities/Media/types';
import { useUploadManager, useUploadQueue, useUploadBlocking, usePublish, useDraftEditing, useDraftMediaMutate } from '../model';
import { useGooglePicker } from '../model/useGooglePicker';
import { useGallerySelection } from 'shared/hooks/gallery';
import { QueueItem } from '../model';
import UploadGallery from './UploadGallery/UploadGallery';
import { PublishButton } from './UploadGallery/PublishButton';
import { UploadItemAction } from './UploadGallery/types';

export interface UploadManagerProps {
  spotId: string;
  sessionId: string;
  spotName?: string | null;
  draftMedia: MediaItem[];
  onPublishSuccess?: (mediaIds: string[]) => void;
  onQueueChange?: (count: number) => void;
}

export function UploadManager({
  spotId,
  sessionId,
  spotName,
  draftMedia,
  onPublishSuccess,
  onQueueChange,
}: UploadManagerProps) {
  const { queue, hasActiveUploads } = useUploadQueue(sessionId, draftMedia);
  const { refetch: refetchDraftMedia, update: updateDraftItem } = useDraftMediaMutate(sessionId);

  const { trigger: openDrivePicker, isPickerLoading, importingItems } = useGooglePicker(spotId, sessionId);

  // Stable ref so effect deps don't change when caller passes an inline function
  const onQueueChangeRef = useRef(onQueueChange);
  useEffect(() => { onQueueChangeRef.current = onQueueChange; });
  useEffect(() => {
    onQueueChangeRef.current?.(queue.length + importingItems.length);
  }, [queue.length, importingItems.length]);

  const getItemId = useCallback((item: QueueItem) => item.mediaId ?? item.id, []);
  // Only completed items are selectable — error items can't be price/date edited
  const selectableItems = useMemo(
    () => queue.filter((item) => item.status === 'completed'),
    [queue]
  );
  const selection = useGallerySelection({ items: selectableItems, getId: getItemId });

  const { addFiles, remove, cancelUpload, removeByMediaIds, retry } = useUploadManager(spotId, sessionId, spotName);

  const { publishStats, isPublishing, publishingIds, handlePublish } = usePublish(
    sessionId,
    queue,
    refetchDraftMedia,
    (mediaIds) => {
      removeByMediaIds(mediaIds);
      onPublishSuccess?.(mediaIds);
    }
  );

  const { handleBulkPriceEdit, handleBulkDateEdit } = useDraftEditing(queue, updateDraftItem);

  const { isBlocked } = useUploadBlocking(spotId);

  // onAction is only wired to 'delete' (actions={['delete']})
  // cancel → onCancelUpload prop; retry → onRetry prop
  const handleItemAction = useCallback((_action: UploadItemAction, itemId: string) => {
    void remove(itemId);
  }, [remove]);

  return (
    <>
      <UploadGallery
        items={[...importingItems, ...queue]}
        hasActiveUploads={hasActiveUploads}
        isBlocked={isBlocked}
        onRemove={remove}
        onCancelUpload={cancelUpload}
        onAddFiles={addFiles}
        onDriveImport={openDrivePicker}
        driveLoading={isPickerLoading}
        publishingIds={publishingIds}
        onRetry={retry}
        onBulkDateEdit={handleBulkDateEdit}
        onBulkPriceEdit={handleBulkPriceEdit}
        actions={['delete']}
        onAction={handleItemAction}
        selection={selection}
      />
      <PublishButton
        total={publishStats.total}
        allReady={publishStats.allReady}
        hasActiveUploads={hasActiveUploads}
        isPublishing={isPublishing}
        selectedCount={selection.selectedCount}
        onPublish={handlePublish}
      />
    </>
  );
}
