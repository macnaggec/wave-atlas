'use client';

import { FC, memo, useMemo, useCallback } from 'react';
import { Button, Group, Menu, rem, ActionIcon } from '@mantine/core';
import { IconTrash, IconRefresh, IconPencil, IconX } from '@tabler/icons-react';
import { UploadItem, QueueItem } from '../../model';
import { BaseGallery, SelectionToolbar } from 'shared/ui/BaseGallery';
import { useUploadStore } from '../../model/uploadStore';
import { UploadIndicatorCompact } from '../UploadIndicator';
import { BlockedUploadPopover } from '../BlockedUploadPopover';
import AddFileCard from '../cards/AddFileCard';
import { UploadCardRenderer } from './UploadCardRenderer';
import { MetadataControls } from './MetadataControls';
import { useMetadataControls } from './useMetadataControls';
import { UploadGalleryProps, UploadItemAction } from './types';

/**
 * Action icon configuration for upload items
 */
const ACTION_ICONS: Record<
  UploadItemAction,
  { icon: typeof IconTrash; label: string; color: string }
> = {
  delete: { icon: IconTrash, label: 'Delete', color: 'red' },
  cancel: { icon: IconX, label: 'Cancel', color: 'gray' },
  retry: { icon: IconRefresh, label: 'Retry', color: 'blue' },
  edit: { icon: IconPencil, label: 'Edit', color: 'gray' },
};

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
    selectedCount: selection.selectedCount,
    hasSelection: selection.hasSelection,
    selectedIds: selection.selectedIds,
    selectedItems: selection.selectedItems,
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
      // Hide individual actions during selection mode - actions move to toolbar menu
      const shouldShowActions = actions.length > 0 && !context.isSelectionMode;

      // In-progress items get cancel; completed/error items get the configured actions
      const isInProgress = !['completed', 'error'].includes(item.status);
      const itemActions = isInProgress ? ['cancel' as UploadItemAction] : actions;

      return (
        <UploadCardRenderer
          item={item}
          onRetry={onRetry}
          actions={
            shouldShowActions ? (
              <Group gap="xs">
                {itemActions.map((actionType) => {
                  const config = ACTION_ICONS[actionType];
                  const Icon = config.icon;

                  return (
                    <ActionIcon
                      key={actionType}
                      variant="filled"
                      color={config.color}
                      size="sm"
                      radius="xl"
                      aria-label={config.label}
                      onClick={(e) => {
                        e.stopPropagation();
                        onAction?.(actionType, item.id);
                      }}
                    >
                      <Icon size={14} />
                    </ActionIcon>
                  );
                })}
              </Group>
            ) : undefined
          }
        />
      );
    },
    [actions, onAction, onRetry]
  );

  return (
    <BaseGallery<UploadItem>
      items={items}
      getId={getItemId}
      selection={selection}
      prepend={onAddFiles && (
        isBlocked ? (
          <BlockedUploadPopover>
            <AddFileCard
              onFilesSelected={handleAddFiles}
              disabled
            />
          </BlockedUploadPopover>
        ) : (
          <AddFileCard
            onFilesSelected={handleAddFiles}
          />
        )
      )}
      toolbar={
        <Group gap="md" justify="space-between" w="100%">
          <Group gap="md">
            {/* Upload indicator when blocked */}
            {isBlocked && <UploadIndicatorCompact />}

            {/* Date/Price controls - always visible */}
            <MetadataControls
              showDateEdit={!!onBulkDateEdit}
              showPriceEdit={!!onBulkPriceEdit}
              selectedDate={metadataState.selectedDate}
              selectedPrice={metadataState.selectedPrice}
              selectedCount={metadataState.selectedCount}
              totalCount={metadataState.totalCount}
              hasExifDates={metadataState.hasExifDates}
              disabled={metadataState.isDisabled}
              tooltip={metadataState.tooltip}
              onDateApply={metadataState.handleDateApply}
              onPriceApply={metadataState.handlePriceApply}
            />
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
export type { UploadGalleryProps } from './types';
