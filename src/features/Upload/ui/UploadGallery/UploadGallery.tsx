import React, { FC, memo, useMemo, useCallback } from 'react';
import { Button, Group, Menu, rem } from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';
import { UploadItem, QueueItem, UploadItemAction } from '../../model';
import { BaseGallery, SelectionToolbar } from 'shared/ui/BaseGallery';
import { UseGallerySelectionReturn } from 'shared/hooks/gallery';
import AddSourceCard from '../cards/AddSourceCard';
import { UploadCardRenderer } from './UploadCardRenderer';
import { MetadataControls } from './MetadataControls';
import { useMetadataControls } from './useMetadataControls';
import { UploadZone } from './UploadZone';
import StepModeModal from './StepModeModal';

export interface UploadGalleryProps {
  items: QueueItem[];
  hasActiveUploads: boolean;
  onRemove: (id: string) => Promise<void>;
  onCancelUpload: (id: string) => Promise<void>;
  onAddFiles?: (files: File[]) => void;
  onBulkDateEdit?: (selectedIds: string[], date: Date) => void;
  onBulkPriceEdit?: (selectedIds: string[], price: number) => void;
  onRetry?: (id: string) => void;
  onDriveImport?: () => void;
  driveLoading?: boolean;
  onAction?: (action: UploadItemAction, itemId: string) => void;
  selection: UseGallerySelectionReturn<QueueItem>;
  onProceed?: (count: number) => void;
  /** Called when the user cancels all uploads and wants to start over. */
  onCancelAll?: () => void;
  /** Clears all items immediately (Zustand) and fires background server cleanup. */
  onDiscardAll: (items: QueueItem[]) => void;
  /** When true, suppresses the zone/indicator in the sidebar (modal still functional). */
  hideZone?: boolean;
  /** Controlled modal open state — overrides internal state when provided. */
  externalModalOpen?: boolean;
  /** Called when internal state wants to change modal visibility. */
  onModalOpenChange?: (open: boolean) => void;
  /** Notifies parent of the price applied per media type (undefined = type not affected). */
  onPricesChange?: (photoPrice?: number, videoPrice?: number) => void;
}

const UploadGallery: FC<UploadGalleryProps> = memo(({
  items,
  hasActiveUploads,
  onRemove,
  onCancelUpload,
  onAddFiles,
  onDriveImport,
  driveLoading,
  onBulkDateEdit,
  onBulkPriceEdit,
  onRetry,
  onAction,
  selection,
  onProceed,
  onCancelAll,
  onDiscardAll,
  hideZone = false,
  externalModalOpen,
  onModalOpenChange,
  onPricesChange,
}) => {
  const getItemId = useCallback(
    (item: QueueItem) => item.mediaId ?? item.id,
    []
  );

  const completedItems = useMemo(
    () => items.filter((item): item is QueueItem => item.status === 'completed'),
    [items]
  );

  const isVideoItem = useCallback(
    (item: QueueItem) =>
      item.cloudinaryResult?.resource_type === 'video' ||
      !!item.file?.type.startsWith('video/'),
    []
  );

  // ========================================================================
  // METADATA CONTROLS (inline gallery only)
  // ========================================================================

  const metadataState = useMetadataControls({
    completedItems,
    selection,
    onBulkDateEdit,
    onBulkPriceEdit,
  });

  // ========================================================================
  // BULK ACTIONS
  // ========================================================================

  const handleAddFiles = useCallback((files: File[]) => {
    selection.disableSelectionMode();
    onAddFiles?.(files);
  }, [onAddFiles, selection.disableSelectionMode]);

  const handleCancelUploads = useCallback(async () => {
    const inProgressItems = items.filter(item =>
      ['pending', 'signing', 'uploading', 'saving'].includes(item.status)
    );
    await Promise.all(inProgressItems.map(item => onCancelUpload(item.id)));
  }, [items, onCancelUpload]);

  const handleBulkDelete = useCallback(
    async (selectedItems: UploadItem[]) => {
      await Promise.all(selectedItems.map(item => onRemove(item.id)));
      selection.clearSelection();
    },
    [onRemove, selection.clearSelection]
  );

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

  const handlePriceApplyWrapped = useCallback((price: number) => {
    metadataState.handlePriceApply(price);
    onPricesChange?.(
      (selection.hasSelection ? (selection.selectedItems as QueueItem[]) : completedItems).some(i => !isVideoItem(i)) ? price : undefined,
      (selection.hasSelection ? (selection.selectedItems as QueueItem[]) : completedItems).some(i => isVideoItem(i)) ? price : undefined,
    );
  }, [metadataState.handlePriceApply, onPricesChange, selection.hasSelection, selection.selectedItems, completedItems, isVideoItem]);

  // ========================================================================
  // RENDER
  // ========================================================================

  const renderCard = useCallback(
    (item: QueueItem, context: { isSelectionMode: boolean }) => {
      const itemActions = context.isSelectionMode ? [] : ['cancel' as UploadItemAction];
      return (
        <UploadCardRenderer
          item={item}
          onRetry={onRetry}
          actions={itemActions}
          onAction={onAction}
          hasDateError={item.status === 'completed' && !!item.result && !item.result.capturedAt}
        />
      );
    },
    [onAction, onRetry]
  );

  // Step-mode: delegate entirely to StepModeModal
  if (onProceed) {
    return (
      <StepModeModal
        items={items}
        hasActiveUploads={hasActiveUploads}
        selection={selection}
        onProceed={onProceed}
        onDiscardAll={onDiscardAll}
        onRemove={onRemove}
        onCancelAll={onCancelAll}
        onAddFiles={onAddFiles}
        onBulkPriceEdit={onBulkPriceEdit}
        onAction={onAction}
        onRetry={onRetry}
        onDriveImport={onDriveImport}
        driveLoading={driveLoading}
        onPricesChange={onPricesChange}
        hideZone={hideZone}
        externalModalOpen={externalModalOpen}
        onModalOpenChange={onModalOpenChange}
      />
    );
  }

  // Empty queue (non-step mode): show full-width upload zone
  if (items.length === 0) {
    return (
      <UploadZone
        onFilesSelected={handleAddFiles}
        onDriveImport={onDriveImport}
        driveLoading={driveLoading}
      />
    );
  }

  return (
    <BaseGallery<UploadItem>
      items={items}
      getId={getItemId}
      selection={selection}
      prepend={onAddFiles && (
        <AddSourceCard
          onFilesSelected={handleAddFiles}
          onDriveImport={onDriveImport}
          driveLoading={driveLoading}
        />
      )}
      toolbar={
        hasActiveUploads ? (
          <Group justify="flex-end">
            <Button
              variant="transparent"
              size="sm"
              radius="xl"
              style={{ color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}
              onClick={handleCancelUploads}
            >
              Cancel uploads
            </Button>
          </Group>
        ) : completedItems.length > 0 ? (
          <SelectionToolbar
            selection={selection}
            renderActions={renderActions}
            renderContent={() => (
              <Group gap="xs">
                {metadataState.totalCount > 0 && (
                  <MetadataControls
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
                    onPriceApply={handlePriceApplyWrapped}
                  />
                )}
              </Group>
            )}
          />
        ) : null
      }
      renderCard={renderCard}
    />
  );
});

UploadGallery.displayName = 'UploadGallery';

export default UploadGallery;
