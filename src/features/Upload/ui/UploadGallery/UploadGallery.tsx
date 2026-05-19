import { FC, memo, useMemo, useCallback } from 'react';
import { Button, Group, Menu, rem } from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';
import { UploadItem, QueueItem } from '../../model';
import { BaseGallery, SelectionToolbar } from 'shared/ui/BaseGallery';
import { useUploadStore } from '../../model/uploadStore';
import { UploadIndicatorCompact } from '../UploadIndicator';
import { BlockedUploadPopover } from '../BlockedUploadPopover';
import AddSourceCard from '../cards/AddSourceCard';
import { UploadCardRenderer } from './UploadCardRenderer';
import { MetadataControls } from './MetadataControls';
import { useMetadataControls } from './useMetadataControls';
import { UploadGalleryProps, UploadItemAction } from './types';

/**
 * UploadGallery - Unified gallery view for uploads and drafts
 *
 * High-level orchestrator that composes:
 * - Gallery widget for layout
 * - UploadCardRenderer for item display
 * - MetadataControls for date/price editing
 * - SelectionToolbar for bulk actions
 * - AddFileCard for new uploads
 *
 * Features:
 * - Unified view (no separation between uploading and completed)
 * - Selection for completed items only
 * - Bulk editing (date/price) for selected completed items
 * - Cancel button during active uploads
 * - Retry for failed uploads
 */
const UploadGallery: FC<UploadGalleryProps> = memo(({
  items,
  hasActiveUploads,
  isBlocked = false,
  onRemove,
  onCancelUpload,
  onAddFiles,
  onBulkDateEdit,
  onBulkPriceEdit,
  onRetry,
  onDriveImport,
  driveLoading,
  publishingIds,
  actions = [],
  onAction,
  selection,
}) => {
  // Use DB media id as key for completed items (mediaId) so React reconciles
  // the Zustand-owned card with the TQ-owned card as the same element after
  // cache update. In-progress items fall back to their client UUID.
  const getItemId = useCallback(
    (item: QueueItem) => item.mediaId ?? item.id,
    []
  );

  // Items eligible for metadata editing (date/price) and publishing.
  // Narrower than selectableItems — error items are selectable for bulk-delete
  // but have no metadata to edit, so they are excluded here intentionally.
  const metadataEditableItems = useMemo(
    () => items.filter((item): item is QueueItem => item.status === 'completed' && !!item.result),
    [items]
  );

  // ========================================================================
  // METADATA CONTROLS
  // ========================================================================

  const metadataState = useMetadataControls({
    completedItems: metadataEditableItems,
    hasActiveUploads,
    selection,
    onBulkDateEdit,
    onBulkPriceEdit,
  });

  // ========================================================================
  // BULK ACTIONS
  // ========================================================================

  // Get uploadingSpotId for navigation link in blocked tooltip
  const uploadingSpotId = useUploadStore(state => state.uploadingSpotId);

  // Handle file addition - disable selection mode when adding new files
  const handleAddFiles = useCallback((files: File[]) => {
    // Always disable selection mode when adding files (requirement from docs/requirements.md)
    selection.disableSelectionMode();
    onAddFiles?.(files);
  }, [onAddFiles, selection.disableSelectionMode]);

  // Cancel all in-progress uploads (aborts HTTP requests only, doesn't delete from DB)
  const handleCancelUploads = useCallback(async () => {
    const inProgressItems = items.filter(item =>
      ['pending', 'signing', 'uploading', 'saving'].includes(item.status)
    );
    await Promise.all(inProgressItems.map(item => onCancelUpload(item.id)));
  }, [items, onCancelUpload]);

  // Delete selected items
  const handleBulkDelete = useCallback(
    async (selectedItems: UploadItem[]) => {
      await Promise.all(selectedItems.map(item => onRemove(item.id)));
      selection.clearSelection();
    },
    [onRemove, selection.clearSelection]
  );

  // Render menu actions for SelectionToolbar
  const renderActions = useCallback(
    (selectedItems: UploadItem[]) => (
      <Menu.Item
        color="red"
        leftSection={<IconTrash style={{ width: rem(14), height: rem(14) }} />}
        onClick={() => handleBulkDelete(selectedItems)}
      >
        Delete {selectedItems.length} {selectedItems.length === 1 ? 'item' : 'items'}
      </Menu.Item>
    ),
    [handleBulkDelete]
  );

  // ========================================================================
  // TOOLBAR RENDERING
  // ========================================================================

  const renderToolbarAction = useCallback(() => {
    if (hasActiveUploads) {
      return (
        <Button variant="subtle" color="red" onClick={handleCancelUploads}>
          Cancel Uploads
        </Button>
      );
    }

    const hasSelectableItems = items.some(
      i => i.status === 'completed'
        || i.status === 'error'
    );

    if (hasSelectableItems) {
      return <SelectionToolbar selection={selection} renderActions={renderActions} />;
    }

    return null;
  }, [hasActiveUploads, items, selection, handleCancelUploads, renderActions]);

  const renderCard = useCallback(
    (item: QueueItem, context: { isSelectionMode: boolean }) => {
      const isInProgress = !['completed', 'error'].includes(item.status);
      const itemActions = context.isSelectionMode
        ? []
        : isInProgress ? ['cancel' as UploadItemAction] : actions;

      const mediaId = item.mediaId ?? item.id;
      return (
        <UploadCardRenderer
          item={item}
          onRetry={onRetry}
          actions={itemActions}
          onAction={onAction}
          hasDateError={item.status === 'completed' && !!item.result && !item.result.capturedAt}
          isPublishing={publishingIds?.has(mediaId)}
        />
      );
    },
    [actions, onAction, onRetry, publishingIds]
  );

  return (
    <BaseGallery<UploadItem>
      items={items}
      getId={getItemId}
      selection={selection}
      prepend={onAddFiles && (
        isBlocked ? (
          <BlockedUploadPopover>
            <AddSourceCard
              onFilesSelected={handleAddFiles}
              onDriveImport={onDriveImport}
              driveLoading={driveLoading}
              disabled
            />
          </BlockedUploadPopover>
        ) : (
          <AddSourceCard
            onFilesSelected={handleAddFiles}
            onDriveImport={onDriveImport}
            driveLoading={driveLoading}
          />
        )
      )}
      toolbar={
        <Group gap="md" justify="space-between" w="100%">
          <Group gap="md">
            {/* Upload indicator when blocked */}
            {isBlocked && <UploadIndicatorCompact />}

            {/* Date/Price controls - visible once items are ready to edit */}
            {metadataState.totalCount > 0 && <MetadataControls
              showDateEdit={!!onBulkDateEdit}
              showPriceEdit={!!onBulkPriceEdit}
              selectedDate={metadataState.selectedDate}
              selectedPrice={metadataState.selectedPrice}
              selectedCount={selection.selectedCount}
              totalCount={metadataState.totalCount}
              hasExifDates={metadataState.hasExifDates}
              disabled={metadataState.isDisabled}
              tooltip={metadataState.tooltip}
              onDateApply={metadataState.handleDateApply}
              onPriceApply={metadataState.handlePriceApply}
            />}
          </Group>

          {renderToolbarAction()}
        </Group>
      }
      renderCard={renderCard}
    />
  );
});

UploadGallery.displayName = 'UploadGallery';

export default UploadGallery;
export type { UploadGalleryProps } from './types';
