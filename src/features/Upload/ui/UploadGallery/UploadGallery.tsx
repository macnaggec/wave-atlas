import { FC, memo, useMemo, useCallback } from 'react';
import { Button, Group, Menu, rem, Stack } from '@mantine/core';
import { IconArrowRight } from '@tabler/icons-react';
import { IconTrash } from '@tabler/icons-react';
import { UploadItem, QueueItem, UploadItemAction } from '../../model';
import { BaseGallery, SelectionToolbar } from 'shared/ui/BaseGallery';
import { UseGallerySelectionReturn } from 'shared/hooks/gallery';
import { useUploadStore } from '../../model/uploadStore';
import { UploadIndicatorCompact } from '../UploadIndicator';
import { BlockedUploadPopover } from '../BlockedUploadPopover';
import AddSourceCard from '../cards/AddSourceCard';
import { UploadCardRenderer } from './UploadCardRenderer';
import { MetadataControls } from './MetadataControls';
import { useMetadataControls } from './useMetadataControls';
import { UploadZone } from './UploadZone';

export interface UploadGalleryProps {
  items: QueueItem[];
  hasActiveUploads: boolean;
  isBlocked?: boolean;
  onRemove: (id: string) => Promise<void>;
  onCancelUpload: (id: string) => Promise<void>;
  onAddFiles?: (files: File[]) => void;
  onBulkDateEdit?: (selectedIds: string[], date: Date) => void;
  onBulkPriceEdit?: (selectedIds: string[], price: number) => void;
  onRetry?: (id: string) => void;
  onDriveImport?: () => void;
  driveLoading?: boolean;
  publishingIds?: Set<string>;
  actions?: UploadItemAction[];
  onAction?: (action: UploadItemAction, itemId: string) => void;
  selection: UseGallerySelectionReturn<QueueItem>;
  onProceed?: (count: number) => void;
}

/**
 * UploadGallery - Unified gallery view for uploads and drafts
 *
 * High-level orchestrator that composes:
 * - Gallery widget for layout
 * - UploadCardRenderer for item display
 * - MetadataControls for date/price editing
 * - SelectionToolbar for bulk actions
 * - AddSourceCard for new uploads (local files + Google Drive)
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
  onDriveImport,
  driveLoading,
  publishingIds,
  onBulkDateEdit,
  onBulkPriceEdit,
  onRetry,
  actions = [],
  onAction,
  selection,
  onProceed,
}) => {
  // Use DB media id as key for completed items (mediaId) so React reconciles
  // the Zustand-owned card with the TQ-owned card as the same element after
  // cache update. In-progress items fall back to their client UUID.
  const getItemId = useCallback(
    (item: QueueItem) => item.mediaId ?? item.id,
    []
  );

  // Only completed items can be selected (uploaded to cloud and ready for metadata editing/publishing)
  // Upload-in-progress items cannot be selected - they show Cancel button instead
  const completedItems = useMemo(
    () => items.filter((item): item is QueueItem => item.status === 'completed' && !!item.result),
    [items]
  );

  // ========================================================================
  // METADATA CONTROLS
  // ========================================================================

  const metadataState = useMetadataControls({
    completedItems,
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
  // RENDER
  // ========================================================================

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

  // Active uploads or uploads done (step mode): 1-col layout, single action button top-right
  // Use raw status check (not completedItems which requires item.result) to avoid timing gaps
  const hasImporting = items.some(item => item.status === 'importing');
  const canProceed = !!onProceed && !hasActiveUploads && !hasImporting && items.some(item => item.status === 'completed');
  const completedCount = canProceed ? items.filter(item => item.status === 'completed').length : 0;
  if (hasActiveUploads || canProceed) {
    return (
      <Stack gap={0}>
        <Group justify="flex-end" px="md" pt="xs" pb={4}>
          {hasActiveUploads ? (
            <Button variant="subtle" color="red" size="xs" onClick={handleCancelUploads}>
              Cancel uploads
            </Button>
          ) : (
            <Button
              size="xs"
              rightSection={<IconArrowRight size={12} />}
              onClick={() => onProceed!(completedCount)}
            >
              Continue with {completedCount} {completedCount === 1 ? 'file' : 'files'}
            </Button>
          )}
        </Group>
        <BaseGallery<UploadItem>
          items={items}
          getId={getItemId}
          renderCard={renderCard}
          columns={1}
        />
      </Stack>
    );
  }

  // Empty queue: show full-width upload zone instead of a lone card in a 3-col grid
  if (items.length === 0) {
    const zone = (
      <UploadZone
        onFilesSelected={handleAddFiles}
        onDriveImport={onDriveImport}
        driveLoading={driveLoading}
        disabled={isBlocked}
      />
    );
    return isBlocked ? <BlockedUploadPopover>{zone}</BlockedUploadPopover> : zone;
  }

  return (
    <BaseGallery<UploadItem>
      items={items}
      getId={getItemId}
      selection={selection}
      prepend={!onProceed && onAddFiles && (
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

          {/* Cancel button during uploads, Select button when complete */}
          {/* Upload-specific: When files are actively uploading, show Cancel instead of Select */}
          {/* This prevents selection mode during uploads since only completed items can be selected */}
          {hasActiveUploads ? (
            <Button variant="subtle" color="red" onClick={handleCancelUploads}>
              Cancel Uploads
            </Button>
          ) : completedItems.length > 0 ? (
            <SelectionToolbar selection={selection} renderActions={renderActions} />
          ) : null}
        </Group>
      }
      renderCard={renderCard}
    />
  );
});

UploadGallery.displayName = 'UploadGallery';

export default UploadGallery;
