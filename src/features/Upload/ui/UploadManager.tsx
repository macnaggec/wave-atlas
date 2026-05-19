'use client';

import { useCallback, useEffect, useMemo } from 'react';
import { MediaItem } from 'entities/Media/types';
import { useUploadManager, useUploadQueue, useUploadBlocking, usePublish, useDraftEditing, useDraftMediaMutate } from '../model';
import { useGooglePicker } from '../model/useGooglePicker';
import { useGallerySelection } from 'shared/hooks/gallery';
import { QueueItem } from '../model';
import UploadGallery from './UploadGallery/UploadGallery';
import { PublishButton } from './UploadGallery/PublishButton';
import { UploadItemAction } from './UploadGallery/types';

export interface UploadManagerProps {
  /**
   * Spot ID to upload to
   */
  spotId: string;

  /**
   * Spot name for display in progress widget
   */
  spotName?: string | null;

  /**
   * User's draft media (authenticated users only)
   */
  draftMedia: MediaItem[];

  /**
   * Callback after successful publish
   */
  onPublishSuccess?: (mediaIds: string[]) => void;

  /**
   * Called whenever the total item count (queue + importing) changes.
   * Used by parent layout to show/hide a pending-uploads indicator.
   */
  onQueueChange?: (count: number) => void;
}

/**
 * UploadManager - Upload workflow composition component
 *
 * Thin wiring layer that composes upload hooks and renders the upload UI.
 * Each concern is fully delegated to a dedicated hook:
 * - `useUploadQueue`   — merges server drafts + active Zustand uploads
 * - `useUploadManager` — upload orchestration (add, remove, retry, metadata)
 * - `usePublish`       — publish server action, notifications, SWR + RSC invalidation
 * - `useDraftEditing`  — bulk price/date metadata editing
 * - `useUploadBlocking`— prevents concurrent uploads across spots
 *
 * Assumes:
 * - User is authenticated
 * - Valid spotId is provided
 *
 * Authentication gating and empty states are handled by parent components.
 */
export function UploadManager({
  spotId,
  spotName,
  draftMedia,
  onPublishSuccess,
  onQueueChange,
}: UploadManagerProps) {
  const { queue, hasActiveUploads } = useUploadQueue(spotId, draftMedia);
  const { refetch: refetchDraftMedia, update: updateDraftItem } = useDraftMediaMutate(spotId);

  const { trigger: openDrivePicker, isPickerLoading, importingItems } = useGooglePicker(spotId);

  useEffect(() => {
    onQueueChange?.(queue.length + importingItems.length);
  }, [queue.length, importingItems.length, onQueueChange]);

  const getItemId = useCallback((item: QueueItem) => item.mediaId ?? item.id, []);
  // Error items are also selectable so users can bulk-delete them
  const selectableItems = useMemo(
    () => queue.filter((item) => item.status === 'completed' || item.status === 'error'),
    [queue]
  );
  const selection = useGallerySelection({ items: selectableItems, getId: getItemId });

  const {
    addFiles,
    remove,
    cancelUpload,
    removeByMediaIds,
    retry,
  } = useUploadManager(spotId, spotName);

  const { publishStats, isPublishing, publishingIds, handlePublish } = usePublish(
    queue,
    refetchDraftMedia,
    selection.selectedIds,
    (mediaIds) => {
      removeByMediaIds(mediaIds);
      onPublishSuccess?.(mediaIds);
    }
  );

  const { handleBulkPriceEdit, handleBulkDateEdit } = useDraftEditing(queue, updateDraftItem);

  const { isBlocked, blockingSpotName } = useUploadBlocking(spotId);

  const handleItemAction = useCallback((
    action: UploadItemAction,
    itemId: string
  ) => {
    if (action === 'delete') {
      void remove(itemId);
    } else if (action === 'cancel') {
      void cancelUpload(itemId);
    } else if (action === 'retry') {
      retry?.(itemId);
    }
  }, [remove, cancelUpload, retry]);

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
