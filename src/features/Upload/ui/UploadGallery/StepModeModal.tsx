import React, { FC, memo, useMemo, useCallback, useState, useEffect, useRef } from 'react';
import { Box, Button, Divider, Group, Loader, Menu, Modal, NumberInput, rem, Text } from '@mantine/core';
import { IconAlertCircle, IconArrowRight, IconCheck, IconPhoto, IconVideo } from '@tabler/icons-react';
import { GalleryCard, getItemId, isVideoItem } from '../../model';
import { BaseGallery, SelectionToolbar } from 'shared/ui/BaseGallery';
import { UseGallerySelectionReturn } from 'shared/hooks/gallery';
import { UploadCardRenderer } from './UploadCardRenderer';
import { UploadZone } from './UploadZone';
import { handleFileSelection } from '../../lib/fileSelection';

export interface StepModeModalProps {
  items: GalleryCard[];
  hasActiveUploads: boolean;
  selection: UseGallerySelectionReturn<GalleryCard>;
  onProceed: (count: number) => void;
  /** Required — ensures Cloudinary cleanup path is never silently dropped. */
  onDiscardAll: (cards: GalleryCard[]) => void;
  onRemove: (card: GalleryCard) => Promise<void>;
  onCancelAll?: () => void;
  onAddFiles?: (files: File[]) => void;
  onBulkPriceEdit?: (selectedIds: string[], price: number) => void;
  onRetry?: (id: string) => void;
  onDriveImport?: () => void;
  driveLoading?: boolean;
  onPricesChange?: (photoPrice?: number, videoPrice?: number) => void;
  hideZone?: boolean;
  externalModalOpen?: boolean;
  onModalOpenChange?: (open: boolean) => void;
}

const StepModeModal: FC<StepModeModalProps> = memo(({
  items,
  hasActiveUploads,
  selection,
  onProceed,
  onDiscardAll,
  onRemove,
  onCancelAll,
  onAddFiles,
  onBulkPriceEdit,
  onRetry,
  onDriveImport,
  driveLoading,
  onPricesChange,
  hideZone = false,
  externalModalOpen,
  onModalOpenChange,
}) => {
  const completedItems = useMemo(
    () => items.filter(card => card.kind === 'draft' || (card.kind === 'uploading' && card.pipelineItem.status === 'completed')),
    [items]
  );

  const photoCompletedItems = useMemo(
    () => completedItems.filter(card => !isVideoItem(card)),
    [completedItems]
  );
  const videoCompletedItems = useMemo(
    () => completedItems.filter(card => isVideoItem(card)),
    [completedItems]
  );

  const hasPhotoItems = useMemo(() => items.some(card => !isVideoItem(card)), [items]);
  const hasVideoItems = useMemo(() => items.some(card => isVideoItem(card)), [items]);

  // ========================================================================
  // TYPE-SPECIFIC PRICE CONTROLS
  // ========================================================================

  const [photoDisplayPrice, setPhotoDisplayPrice] = useState<number | string>(3);
  const [videoDisplayPrice, setVideoDisplayPrice] = useState<number | string>(3);

  const photoSynced = useRef(false);
  const videoSynced = useRef(false);
  const serverPhotoPrice = photoCompletedItems.find(card => card.result?.price !== undefined)?.result?.price;
  const serverVideoPrice = videoCompletedItems.find(card => card.result?.price !== undefined)?.result?.price;
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
  // MODAL OPEN STATE
  // ========================================================================

  const [internalModalOpen, setInternalModalOpen] = useState(false);
  const effectiveModalOpen = externalModalOpen !== undefined ? externalModalOpen : internalModalOpen;
  const onModalOpenChangeRef = useRef(onModalOpenChange);
  onModalOpenChangeRef.current = onModalOpenChange;
  const handleModalChange = useCallback((open: boolean) => {
    setInternalModalOpen(open);
    onModalOpenChangeRef.current?.(open);
  }, []);

  // Guard: only fire handleModalChange(false) when the modal was previously shown,
  // not on the very first render — prevents callers from reacting to the initial false signal.
  const hasBeenShownRef = useRef(false);
  useEffect(() => {
    if (items.length > 0) {
      hasBeenShownRef.current = true;
      handleModalChange(true);
    } else if (hasBeenShownRef.current) {
      handleModalChange(false);
    }
  }, [items.length]);

  // ========================================================================
  // FILE HANDLING
  // ========================================================================

  const handleAddFiles = useCallback((files: File[]) => {
    selection.disableSelectionMode();
    onAddFiles?.(files);
  }, [onAddFiles, selection.disableSelectionMode]);

  const addMoreInputRef = useRef<HTMLInputElement>(null);
  const handleAddMoreChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    handleFileSelection(files, handleAddFiles);
  }, [handleAddFiles]);

  // ========================================================================
  // BULK ACTIONS
  // ========================================================================

  const handleCancelAll = useCallback(() => {
    onDiscardAll(items);
    onCancelAll?.();
  }, [items, onDiscardAll, onCancelAll]);

  const handleBulkDelete = useCallback(
    async (selectedCards: GalleryCard[]) => {
      await Promise.all(selectedCards.map(card => onRemove(card)));
      selection.clearSelection();
    },
    [onRemove, selection.clearSelection]
  );

  const renderActions = useCallback(
    (selectedCards: GalleryCard[]) => (
      <Menu.Item
        color="red"
        leftSection={<IconAlertCircle style={{ width: rem(14), height: rem(14) }} />}
        onClick={() => handleBulkDelete(selectedCards)}
      >
        Delete {selectedCards.length} {selectedCards.length === 1 ? 'item' : 'items'}
      </Menu.Item>
    ),
    [handleBulkDelete]
  );

  const renderCard = useCallback(
    (card: GalleryCard, context: { isSelectionMode: boolean }) => {
      const isSaving = card.kind === 'uploading' && card.pipelineItem.status === 'saving';
      const hasDateError = (card.kind === 'draft' || card.pipelineItem.status === 'completed')
        && !!card.result
        && !card.result.capturedAt;
      return (
        <UploadCardRenderer
          item={card}
          onRetry={onRetry}
          onRemove={context.isSelectionMode ? undefined : onRemove}
          hideRemove={isSaving}
          hasDateError={hasDateError}
        />
      );
    },
    [onRemove, onRetry]
  );

  // ========================================================================
  // CONTINUE
  // ========================================================================

  const hasImporting = items.some(card => card.kind === 'uploading' && card.pipelineItem.status === 'importing');
  const canProceed = !hasActiveUploads && !hasImporting && completedItems.length > 0;
  const completedCount = canProceed ? completedItems.length : 0;

  // Error cards with an orphaned Cloudinary asset (upload failed before DB write).
  const orphanErrorCards = useMemo(
    () => items.filter(card =>
      card.kind === 'uploading' &&
      card.pipelineItem.status === 'error' &&
      card.pipelineItem.cloudinaryResult &&
      !card.pipelineItem.mediaId
    ),
    [items]
  );

  const handleContinue = useCallback(() => {
    if (onBulkPriceEdit) {
      const pp = typeof photoDisplayPrice === 'number' ? photoDisplayPrice : parseFloat(String(photoDisplayPrice));
      const vp = typeof videoDisplayPrice === 'number' ? videoDisplayPrice : parseFloat(String(videoDisplayPrice));
      const photoIds = photoCompletedItems.map(card => getItemId(card));
      const videoIds = videoCompletedItems.map(card => getItemId(card));
      if (photoIds.length > 0 && !isNaN(pp) && pp > 0) {
        void onBulkPriceEdit(photoIds, pp);
        onPricesChange?.(pp, undefined);
      }
      if (videoIds.length > 0 && !isNaN(vp) && vp > 0) {
        void onBulkPriceEdit(videoIds, vp);
        onPricesChange?.(undefined, vp);
      }
    }
    // Clean up any orphaned Cloudinary assets from error cards before leaving.
    if (orphanErrorCards.length > 0) onDiscardAll(orphanErrorCards);
    handleModalChange(false);
    onProceed(completedCount);
  }, [photoDisplayPrice, videoDisplayPrice, photoCompletedItems, videoCompletedItems, onBulkPriceEdit, onPricesChange, orphanErrorCards, onDiscardAll, handleModalChange, onProceed, completedCount]);

  // ========================================================================
  // RENDER
  // ========================================================================

  const uploadingCount = useMemo(
    () => items.filter(card => card.kind === 'uploading' && ['pending', 'signing', 'uploading', 'saving'].includes(card.pipelineItem.status)).length,
    [items]
  );

  const modal = (
    <Modal
      opened={effectiveModalOpen && items.length > 0}
      onClose={() => {
        // Clean up orphaned Cloudinary assets before calling onProceed.
        if (orphanErrorCards.length > 0) onDiscardAll(orphanErrorCards);
        handleModalChange(false);
        if (items.length > 0 && completedCount > 0) onProceed(completedCount);
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
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <Box p="md">
          <BaseGallery<GalleryCard>
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

  // Indicator is rendered regardless of hideZone — hideZone only suppresses the UploadZone drop target.
  // When externalModalOpen is provided the caller manages modal state and renders its own indicator
  // (e.g. FilesPill in UploadSidebar); suppress ours to avoid duplication.
  const indicator = externalModalOpen === undefined && items.length > 0 && !effectiveModalOpen ? (
    <Group
      px="md" py="xs" gap="xs"
      justify="space-between"
      onClick={() => handleModalChange(true)}
      style={{ cursor: 'pointer' }}
    >
      <Group gap="xs">
        {hasActiveUploads
          ? <Loader size={12} />
          : completedCount > 0
            ? <IconCheck size={12} style={{ color: 'var(--mantine-color-green-5)' }} />
            : <IconAlertCircle size={12} style={{ color: 'var(--mantine-color-red-5)' }} />}
        <Text size="xs" c="dimmed">
          {hasActiveUploads
            ? `${uploadingCount} of ${items.length} uploading…`
            : completedCount > 0
              ? `${completedCount} ${completedCount === 1 ? 'file' : 'files'} ready`
              : 'Upload failed'}
        </Text>
      </Group>
      <Text size="xs" c="blue.4" fw={500}>View</Text>
    </Group>
  ) : null;

  if (hideZone) {
    return (
      <>
        {indicator}
        {modal}
      </>
    );
  }

  return (
    <>
      {indicator}
      <UploadZone
        onFilesSelected={handleAddFiles}
        onDriveImport={onDriveImport}
        driveLoading={driveLoading}
      />
      {modal}
    </>
  );
});

StepModeModal.displayName = 'StepModeModal';

export default StepModeModal;
