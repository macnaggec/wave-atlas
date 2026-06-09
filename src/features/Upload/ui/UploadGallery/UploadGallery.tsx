import React, { FC, memo, useMemo, useCallback, useState, useEffect, useRef } from 'react';
import { Box, Button, Divider, Group, Loader, Menu, Modal, NumberInput, rem, Text } from '@mantine/core';
import { IconArrowRight, IconCheck, IconPhoto, IconTrash, IconVideo } from '@tabler/icons-react';
import { UploadItem, QueueItem, UploadItemAction } from '../../model';
import { BaseGallery, SelectionToolbar } from 'shared/ui/BaseGallery';
import { UseGallerySelectionReturn } from 'shared/hooks/gallery';
import AddSourceCard from '../cards/AddSourceCard';
import { UploadCardRenderer } from './UploadCardRenderer';
import { MetadataControls } from './MetadataControls';
import { useMetadataControls } from './useMetadataControls';
import { validateFileBatch } from 'entities/Media';
import { notifications } from '@mantine/notifications';
import { UploadZone } from './UploadZone';

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
  /** When true, suppresses the zone/indicator in the sidebar (modal still functional). */
  hideZone?: boolean;
  /** Controlled modal open state — overrides internal state when provided. */
  externalModalOpen?: boolean;
  /** Called when internal state wants to change modal visibility. */
  onModalOpenChange?: (open: boolean) => void;
  /** Notifies parent of the price applied per media type (undefined = type not affected). */
  onPricesChange?: (photoPrice?: number, videoPrice?: number) => void;
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
  hideZone = false,
  externalModalOpen,
  onModalOpenChange,
  onPricesChange,
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
  // METADATA CONTROLS
  // ========================================================================

  const metadataState = useMetadataControls({
    completedItems,
    selection,
    onBulkDateEdit,
    onBulkPriceEdit,
  });

  // ========================================================================
  // TYPE-SPECIFIC PRICE CONTROLS (step-mode modal)
  // ========================================================================

  const photoCompletedItems = useMemo(
    () => completedItems.filter(i => !isVideoItem(i)),
    [completedItems, isVideoItem]
  );
  const videoCompletedItems = useMemo(
    () => completedItems.filter(i => isVideoItem(i)),
    [completedItems, isVideoItem]
  );

  // Detect types from all queued items so price inputs appear immediately on upload
  const hasPhotoItems = useMemo(() => items.some(i => !isVideoItem(i)), [items, isVideoItem]);
  const hasVideoItems = useMemo(() => items.some(i => isVideoItem(i)), [items, isVideoItem]);

  const [photoDisplayPrice, setPhotoDisplayPrice] = useState<number | string>(3);
  const [videoDisplayPrice, setVideoDisplayPrice] = useState<number | string>(3);

  // Sync display prices from server on first load (step 4 wires real result data).
  // One-shot: avoids clobbering user edits on subsequent server refreshes.
  const photoSynced = useRef(false);
  const videoSynced = useRef(false);
  const serverPhotoPrice = photoCompletedItems.find(i => i.result?.price !== undefined)?.result?.price;
  const serverVideoPrice = videoCompletedItems.find(i => i.result?.price !== undefined)?.result?.price;
  useEffect(() => {
    if (!photoSynced.current && serverPhotoPrice !== undefined) {
      setPhotoDisplayPrice(serverPhotoPrice / 100);
      photoSynced.current = true;
    }
  }, [serverPhotoPrice]);
  useEffect(() => {
    if (!videoSynced.current && serverVideoPrice !== undefined) {
      setVideoDisplayPrice(serverVideoPrice / 100);
      videoSynced.current = true;
    }
  }, [serverVideoPrice]);

  const handlePhotoDisplayPriceChange = useCallback((val: number | string) => {
    setPhotoDisplayPrice(val);
    const p = typeof val === 'number' ? val : parseFloat(String(val));
    if (!isNaN(p) && p > 0) onPricesChange?.(p, undefined);
  }, [onPricesChange]);

  const handleVideoDisplayPriceChange = useCallback((val: number | string) => {
    setVideoDisplayPrice(val);
    const p = typeof val === 'number' ? val : parseFloat(String(val));
    if (!isNaN(p) && p > 0) onPricesChange?.(undefined, p);
  }, [onPricesChange]);

  // ========================================================================
  // BULK ACTIONS
  // ========================================================================

  // Handle file addition - disable selection mode when adding new files
  const handleAddFiles = useCallback((files: File[]) => {
    // Always disable selection mode when adding files (requirement from docs/requirements.md)
    selection.disableSelectionMode();
    onAddFiles?.(files);
  }, [onAddFiles, selection.disableSelectionMode]);

  // "Add more" file input for the step-mode modal footer
  const addMoreInputRef = useRef<HTMLInputElement>(null);
  const handleAddMoreChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!files.length) return;
    const { valid, validFiles, errors, warnings } = validateFileBatch(files);
    if (!valid) {
      notifications.show({ title: 'Upload Error', message: errors.join('\n'), color: 'red', autoClose: 8000 });
      if (validFiles.length > 0) {
        notifications.show({ title: 'Partial Upload', message: `${validFiles.length} of ${files.length} files will be uploaded`, color: 'yellow', autoClose: 5000 });
        handleAddFiles(validFiles);
      }
    } else {
      if (warnings.length > 0)
        notifications.show({ title: 'Upload Warning', message: warnings.join('\n'), color: 'yellow', autoClose: 5000 });
      handleAddFiles(validFiles);
    }
  }, [handleAddFiles]);

  // Cancel all in-progress uploads (aborts HTTP requests only, doesn't delete from DB)
  const handleCancelUploads = useCallback(async () => {
    const inProgressItems = items.filter(item =>
      ['pending', 'signing', 'uploading', 'saving'].includes(item.status)
    );
    await Promise.all(inProgressItems.map(item => onCancelUpload(item.id)));
  }, [items, onCancelUpload]);

  // Cancel everything and reset to empty zone.
  // Removes all items from Zustand immediately (abort in-progress, revoke blobs) so
  // the UI resets without waiting for the network. DB cleanup fires in the background.
  const handleCancelAll = useCallback(() => {
    const mediaIdsToDelete = items
      .filter(i => i.status === 'completed' && i.mediaId)
      .map(i => i.mediaId!);

    // Abort + remove all items from Zustand synchronously
    items.forEach(item => void onCancelUpload(item.id));

    // Background: delete completed media from DB (fire and forget)
    mediaIdsToDelete.forEach(mediaId => void onRemove(mediaId));

    onCancelAll?.();
  }, [items, onCancelUpload, onRemove, onCancelAll]);

  // Intercept price apply to notify parent and keep modal price inputs in sync
  const handlePriceApplyWrapped = useCallback((price: number) => {
    metadataState.handlePriceApply(price);
    const affected = selection.hasSelection
      ? (selection.selectedItems as QueueItem[])
      : completedItems;
    const affectsPhotos = affected.some(i => !isVideoItem(i));
    const affectsVideos = affected.some(i => isVideoItem(i));
    if (affectsPhotos) setPhotoDisplayPrice(price);
    if (affectsVideos) setVideoDisplayPrice(price);
    onPricesChange?.(
      affectsPhotos ? price : undefined,
      affectsVideos ? price : undefined,
    );
  }, [metadataState.handlePriceApply, onPricesChange, selection.hasSelection, selection.selectedItems, completedItems, isVideoItem]);

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
      const itemActions = context.isSelectionMode ? [] : ['cancel' as UploadItemAction];

      const mediaId = item.mediaId ?? item.id;
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

  // Step-mode modal visibility: auto-open when items appear, auto-close when queue empties.
  // Can be driven externally via externalModalOpen/onModalOpenChange (e.g. FilesPill re-open).
  const [internalModalOpen, setInternalModalOpen] = useState(false);
  const effectiveModalOpen = externalModalOpen !== undefined ? externalModalOpen : internalModalOpen;
  const onModalOpenChangeRef = useRef(onModalOpenChange);
  onModalOpenChangeRef.current = onModalOpenChange;
  const handleModalChange = useCallback((open: boolean) => {
    setInternalModalOpen(open);
    onModalOpenChangeRef.current?.(open);
  }, []);
  useEffect(() => {
    if (!onProceed) return;
    if (items.length > 0) handleModalChange(true);
    else handleModalChange(false);
  }, [items.length, onProceed]);

  // Use raw status check (not completedItems which requires item.result) to avoid timing gaps
  const hasImporting = items.some(item => item.status === 'importing');
  const canProceed = !!onProceed && !hasActiveUploads && !hasImporting && items.some(item => item.status === 'completed');
  const completedCount = canProceed ? items.filter(item => item.status === 'completed').length : 0;

  const handleContinue = useCallback(() => {
    if (onBulkPriceEdit) {
      const pp = typeof photoDisplayPrice === 'number' ? photoDisplayPrice : parseFloat(String(photoDisplayPrice));
      const vp = typeof videoDisplayPrice === 'number' ? videoDisplayPrice : parseFloat(String(videoDisplayPrice));
      const photoIds = photoCompletedItems.map(i => i.mediaId ?? i.id);
      const videoIds = videoCompletedItems.map(i => i.mediaId ?? i.id);
      if (photoIds.length > 0 && !isNaN(pp) && pp > 0) {
        void onBulkPriceEdit(photoIds, pp);
        onPricesChange?.(pp, undefined);
      }
      if (videoIds.length > 0 && !isNaN(vp) && vp > 0) {
        void onBulkPriceEdit(videoIds, vp);
        onPricesChange?.(undefined, vp);
      }
    }
    handleModalChange(false);
    onProceed!(completedCount);
  }, [photoDisplayPrice, videoDisplayPrice, photoCompletedItems, videoCompletedItems, onBulkPriceEdit, onPricesChange, handleModalChange, onProceed, completedCount]);

  // Step mode: zone stays in sidebar; selected media opens in a modal
  if (onProceed) {
    const uploadingCount = items.filter(i =>
      ['pending', 'signing', 'uploading', 'saving'].includes(i.status)
    ).length;

    const modal = (
      <Modal
        opened={effectiveModalOpen && items.length > 0}
        onClose={() => {
          handleModalChange(false);
          if (items.length > 0) onProceed!(completedCount);
        }}
        closeOnClickOutside={false}
        closeOnEscape={false}
        size={1000}
        centered
        title="Selected media"
        overlayProps={{ backgroundOpacity: 0.45, blur: 4 }}
        styles={{
          body: { padding: 0, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 },
          content: {
            background: 'rgba(255, 255, 255, 0.08)',
            backdropFilter: 'blur(12px) saturate(140%)',
            border: '1px solid rgba(255,255,255,0.14)',
            borderRadius: 16,
            overflow: 'hidden',
            maxHeight: '92vh',
            display: 'flex',
            flexDirection: 'column',
            '--mantine-color-gray-0': 'rgba(255,255,255,0.08)',
          } as React.CSSProperties,
          header: {
            background: 'transparent',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            padding: '8px 12px',
            minHeight: 0,
          },
          title: { color: '#fff', fontWeight: 600, fontSize: 13 },
          close: { color: 'rgba(255,255,255,0.55)', width: 24, height: 24, minWidth: 0, minHeight: 0 },
        }}
      >
        <input
          ref={addMoreInputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          onChange={handleAddMoreChange}
          style={{ display: 'none' }}
        />
        {/* Scrollable gallery — native div so position:sticky and useScrollHidden work */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <Box p="md">
            <BaseGallery<UploadItem>
            items={items}
            getId={getItemId}
            selection={selection}
            toolbar={onBulkPriceEdit ? (
              <SelectionToolbar
                selection={selection}
                renderActions={renderActions}
                renderContent={() => (
                  <Group gap="xs" align="center">
                    {hasPhotoItems && (
                      <NumberInput
                        size="xs"
                        leftSection={<IconPhoto size={12} style={{ color: 'rgba(255,255,255,0.45)' }} />}
                        value={photoDisplayPrice}
                        onChange={handlePhotoDisplayPriceChange}
                        min={3}
                        step={1}
                        decimalScale={0}
                        prefix="$"
                        placeholder="Free"
                        w={90}
                        styles={{
                          input: { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' },
                          controls: { borderLeft: '1px solid rgba(255,255,255,0.08)' },
                          control: { borderColor: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.35)' },
                        }}
                      />
                    )}
                    {hasVideoItems && (
                      <NumberInput
                        size="xs"
                        leftSection={<IconVideo size={12} style={{ color: 'rgba(255,255,255,0.45)' }} />}
                        value={videoDisplayPrice}
                        onChange={handleVideoDisplayPriceChange}
                        min={3}
                        step={1}
                        decimalScale={0}
                        prefix="$"
                        placeholder="Free"
                        w={90}
                        styles={{
                          input: { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' },
                          controls: { borderLeft: '1px solid rgba(255,255,255,0.08)' },
                          control: { borderColor: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.35)' },
                        }}
                      />
                    )}
                  </Group>
                )}
              />
            ) : undefined}
            renderCard={renderCard}
            columns={3}
          />
        </Box>
        </div>

        <Divider style={{ borderColor: 'rgba(255,255,255,0.08)' }} />
        <Group px="sm" py={6} justify="space-between">
          <Button
            variant="transparent" size="xs" radius="xl"
            style={{ color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}
            onClick={handleCancelAll}
          >
            Discard
          </Button>
          <Group gap="xs">
            {onAddFiles && (
              <Button
                variant="transparent" size="xs" radius="xl"
                style={{ color: 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.08)' }}
                onClick={() => addMoreInputRef.current?.click()}
              >
                Add more
              </Button>
            )}
            {hasActiveUploads ? (
              <Group gap="xs">
                <Loader size={12} />
                <Text size="xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  {uploadingCount} of {items.length} uploading…
                </Text>
              </Group>
            ) : canProceed ? (
              <Button
                variant="transparent" size="xs" radius="xl"
                rightSection={<IconArrowRight size={12} />}
                style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.16)', color: '#fff' }}
                onClick={handleContinue}
              >
                Continue with {completedCount} {completedCount === 1 ? 'file' : 'files'}
              </Button>
            ) : null}
          </Group>
        </Group>
      </Modal>
    );

    // hideZone: used when re-opening the modal from FilesPill after upload is confirmed.
    // The zone and indicator must not render in the sidebar again.
    if (hideZone) return modal;

    const zone = (
      <UploadZone
        onFilesSelected={handleAddFiles}
        onDriveImport={onDriveImport}
        driveLoading={driveLoading}
      />
    );

    const indicator = items.length > 0 && !effectiveModalOpen ? (
      <Group
        px="md" py="xs" gap="xs"
        justify="space-between"
        onClick={() => handleModalChange(true)}
        style={{ cursor: 'pointer' }}
      >
        <Group gap="xs">
          {hasActiveUploads
            ? <Loader size={12} />
            : <IconCheck size={12} style={{ color: 'var(--mantine-color-green-5)' }} />}
          <Text size="xs" c="dimmed">
            {hasActiveUploads
              ? `${uploadingCount} of ${items.length} uploading…`
              : `${completedCount} ${completedCount === 1 ? 'file' : 'files'} ready`}
          </Text>
        </Group>
        <Text size="xs" c="blue.4" fw={500}>View</Text>
      </Group>
    ) : null;

    return (
      <>
        {indicator}
        {zone}
        {modal}
      </>
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
      prepend={!onProceed && onAddFiles && (
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
