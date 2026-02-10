'use client';

import React, { FC, memo, useMemo, useState, useCallback } from 'react';
import { UploadItem } from './useUploadManager';
import Gallery from 'widgets/Gallery/Gallery';
import DraftCard from './cards/DraftCard';
import DraftOverlays from './overlays/DraftOverlays';
import UploadingOverlays from './overlays/UploadingOverlays';
import AddFileCard from 'widgets/Gallery/cards/AddFileCard';
import SelectionToolbar from 'widgets/Gallery/toolbars/SelectionToolbar';
import { DateEditPopover, PriceEditPopover } from './popovers';
import { useGallerySelection } from 'shared/hooks/gallery';
import { ActionIcon, Menu, rem, Button, Group } from '@mantine/core';
import { IconX, IconTrash } from '@tabler/icons-react';

/**
 * Memoized delete button to prevent icon blob URL regeneration.
 * Stable across re-renders for the same item ID.
 */
const DeleteButton = memo<{
  onRemove: (id: string) => Promise<void>;
  itemId: string
}>(({ onRemove, itemId }) => {
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      void onRemove(itemId);
    },
    [onRemove, itemId]
  );

  return (
    <ActionIcon
      variant="filled"
      color="red"
      size="sm"
      radius="xl"
      onClick={handleClick}
    >
      <IconX size={14} />
    </ActionIcon>
  );
},
  // Custom comparison: only re-render if itemId changes
  (prevProps, nextProps) => prevProps.itemId === nextProps.itemId
);

DeleteButton.displayName = 'DeleteButton';

/**
 * Memoized card renderer to prevent unnecessary DOM re-mounts
 */
const UploadCardRenderer = memo<{
  item: UploadItem;
  onRemove: (id: string) => Promise<void>;
}>(
  ({ item, onRemove }) => {
    const isCompleted = item.status === 'completed';

    // Extract display props inline to avoid object spreading
    const imageUrl = isCompleted && item.result
      ? item.result.resource.url
      : item.previewUrl;

    const resourceType = (isCompleted && item.result
      ? item.result.resource.resource_type
      : item.file?.type.startsWith('video/') ? 'video' : 'image') as 'image' | 'video';

    const playbackUrl = isCompleted && item.result
      ? item.result.resource.playback_url
      : undefined;

    const alt = isCompleted && item.result
      ? `Media ${item.result.resource.asset_id}`
      : item.file?.name || 'Upload preview';

    // Choose overlays based on status
    const overlays = isCompleted && item.result
      ? <DraftOverlays mediaItem={item.result} />
      : (
        <UploadingOverlays
          status={item.status}
          progress={item.progress}
          error={item.error}
        />
      );


    return (
      <DraftCard
        imageUrl={imageUrl}
        resourceType={resourceType}
        playbackUrl={playbackUrl}
        alt={alt}
        overlays={overlays}
        actions={<DeleteButton itemId={item.id} onRemove={onRemove} />}
        validation={
          isCompleted && item.result && !item.result.capturedAt
            ? { hasError: true, message: 'Date required for publishing' }
            : undefined
        }
      />
    );
  },
  // Only re-render if item status/progress/metadata/error changes
  (prev, next) =>
    prev.item.id === next.item.id &&
    prev.item.status === next.item.status &&
    prev.item.progress === next.item.progress &&
    prev.item.error === next.item.error &&
    prev.item.result?.capturedAt === next.item.result?.capturedAt &&
    prev.item.result?.price === next.item.result?.price
);

UploadCardRenderer.displayName = 'UploadCardRenderer';

/**
 * Props for UploadGallery component
 */
export interface UploadGalleryProps {
  /** Array of upload items (both uploading and completed) */
  items: UploadItem[];

  /** Callback to remove an item (async - deletes from DB for drafts) */
  onRemove: (id: string) => Promise<void>;

  /** Callback to add new files */
  onAddFiles?: (files: File[]) => void;

  /** Callback for bulk date editing */
  onBulkDateEdit?: (selectedIds: string[], date: Date) => void;

  /** Callback for bulk price editing */
  onBulkPriceEdit?: (selectedIds: string[], price: number) => void;

  /** Callback to retry failed upload */
  onRetry?: (id: string) => void;
}

/**
 * Helper to extract display properties from UploadItem
 */
function getDisplayProps(item: UploadItem) {
  if (item.status === 'completed' && item.result) {
    // Completed draft - use MediaItem data
    return {
      imageUrl: item.result.resource.url,
      resourceType: item.result.resource.resource_type as 'image' | 'video',
      playbackUrl: item.result.resource.playback_url,
      alt: `Media ${item.result.resource.asset_id}`,
    };
  }

  // Uploading or failed - use preview
  const resourceType = item.file?.type.startsWith('video/') ? 'video' : 'image';

  return {
    imageUrl: item.previewUrl,
    resourceType: resourceType as 'image' | 'video',
    playbackUrl: undefined,
    alt: item.file?.name || 'Upload preview',
  };
}

/**
 * UploadGallery - Unified gallery view for uploads and drafts
 *
 * Displays both in-progress uploads and completed drafts in a single
 * grid layout. Uses slot-based Gallery widget with conditional overlay
 * rendering based on upload status.
 *
 * Features:
 * - Unified view (no separation between uploading and completed)
 * - Selection for completed items only
 * - Bulk editing (date/price) for selected completed items
 * - Cancel button for all items
 * - Retry for failed uploads
 *
 * @example
 * ```tsx
 * const { queue, addFiles, remove, retry } = useUploadManager(spotId);
 *
 * <UploadGallery
 *   items={queue}
 *   onRemove={remove}
 *   onAddFiles={addFiles}
 *   onRetry={retry}
 *   onBulkDateEdit={handleBulkDate}
 *   onBulkPriceEdit={handleBulkPrice}
 * />
 * ```
 */
const UploadGallery: FC<UploadGalleryProps> = memo(({
  items,
  onRemove,
  onAddFiles,
  onBulkDateEdit,
  onBulkPriceEdit,
  onRetry,
}) => {
  // Track selected date and price for pills
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedPrice, setSelectedPrice] = useState<number>(0);

  // Stable getId function for Gallery and selection
  const getItemId = useCallback((item: UploadItem) => item.id, []);

  // Only completed items can be selected
  const completedItems = useMemo(
    () => items.filter(item => item.status === 'completed' && item.result),
    [items]
  );

  const selection = useGallerySelection({
    items: completedItems,
    getId: getItemId,
  });

  // Memoize handlers to avoid closure issues with stale selection state
  const handleDateApply = useCallback((date: Date) => {
    const selectedIdsArray = [...selection.selectedIds];
    setSelectedDate(date);
    onBulkDateEdit?.(selectedIdsArray, date);
  }, [selection.selectedIds, onBulkDateEdit]);

  const handlePriceApply = useCallback((price: number) => {
    const selectedIdsArray = [...selection.selectedIds];
    setSelectedPrice(price);
    onBulkPriceEdit?.(selectedIdsArray, price);
  }, [selection.selectedIds, onBulkPriceEdit]);

  // Check if selected items (or all if none selected) have EXIF dates
  const hasExifDates = useMemo(() => {
    const targetItems = selection.hasSelection
      ? selection.selectedItems
      : completedItems;

    return targetItems.some(
      item => item.result?.dateSource === 'exif'
    );
  }, [selection.hasSelection, selection.selectedItems, completedItems]);

  // Memoized bulk delete handler to prevent re-renders
  const handleBulkDelete = useCallback(async (selectedItems: UploadItem[]) => {
    await Promise.all(selectedItems.map(item => onRemove(item.id)));
    selection.clearSelection();
  }, [onRemove, selection.clearSelection]);

  // Memoized render actions to stabilize SelectionToolbar props
  const renderActions = useCallback((selectedItems: UploadItem[]) => (
    <Menu.Item
      color="red"
      leftSection={<IconTrash style={{ width: rem(14), height: rem(14) }} />}
      onClick={() => handleBulkDelete(selectedItems)}
    >
      Delete {selectedItems.length} {selectedItems.length === 1 ? 'item' : 'items'}
    </Menu.Item>
  ), [handleBulkDelete]);

  // Memoized render content to stabilize SelectionToolbar props
  const renderContent = useCallback(() => (
    <Group gap="sm">
      {onBulkDateEdit && (
        <DateEditPopover
          value={selectedDate}
          selectedCount={selection.selectedCount}
          totalCount={completedItems.length}
          hasExifDates={hasExifDates}
          onApply={handleDateApply}
        />
      )}
      {onBulkPriceEdit && (
        <PriceEditPopover
          value={selectedPrice}
          selectedCount={selection.selectedCount}
          totalCount={completedItems.length}
          onApply={handlePriceApply}
        />
      )}
    </Group>
  ), [
    onBulkDateEdit,
    onBulkPriceEdit,
    selectedDate,
    selectedPrice,
    selection.selectedCount,
    completedItems.length,
    hasExifDates,
    handleDateApply,
    handlePriceApply,
  ]);

  // Memoized render card to stabilize Gallery props
  const renderCard = useCallback((item: UploadItem) => (
    <UploadCardRenderer item={item} onRemove={onRemove} />
  ), [onRemove]);

  return (
    <Gallery<UploadItem>
      items={items}
      getId={getItemId}
      selection={selection}
      prepend={onAddFiles && <AddFileCard onFilesSelected={onAddFiles} />}
      toolbar={
        <SelectionToolbar
          selection={selection}
          renderActions={renderActions}
          renderContent={renderContent}
        />
      }
      renderCard={renderCard}
    />
  );
});

UploadGallery.displayName = 'UploadGallery';

export default UploadGallery;
