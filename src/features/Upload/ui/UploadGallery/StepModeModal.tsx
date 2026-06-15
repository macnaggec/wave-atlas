import React, { FC, memo, useMemo, useCallback, useState, useEffect, useRef } from 'react';
import { Box, Button, Divider, Group, Loader, Menu, Modal, rem, Text, ThemeIcon } from '@mantine/core';
import { IconAlertCircle, IconArrowRight, IconCheck, IconPhoto, IconVideo } from '@tabler/icons-react';
import { GalleryCard, getItemId } from '../../model';
import { BaseGallery, SelectionToolbar } from 'shared/ui/BaseGallery';
import { UseGallerySelectionReturn } from 'shared/hooks/gallery';
import { UploadCardRenderer } from './UploadCardRenderer';
import { UploadZone } from './UploadZone';
import { handleFileSelection } from '../../lib/fileSelection';

export interface StepModeModalProps {
  items: GalleryCard[];
  hasActiveUploads: boolean;
  filesErrorTick?: number;
  selection: UseGallerySelectionReturn<GalleryCard>;
  onProceed?: (count: number) => void;
  /** Required — ensures Cloudinary cleanup path is never silently dropped. */
  onDiscardAll: (cards: GalleryCard[]) => void;
  onRemove: (kind: GalleryCard['kind'], id: string) => Promise<void>;
  onAddFiles?: (files: File[]) => void;
  onRetry?: (id: string) => void;
  onDriveImport?: () => void;
  driveLoading?: boolean;
}

export const StepModeModal: FC<StepModeModalProps> = memo(({
  items,
  hasActiveUploads,
  filesErrorTick,
  selection,
  onProceed,
  onDiscardAll,
  onRemove,
  onAddFiles,
  onRetry,
  onDriveImport,
  driveLoading,
}) => {
  const completedItems = useMemo(
    () => items.filter(card => card.kind === 'draft' || (card.kind === 'uploading' && card.pipelineItem.status === 'completed')),
    [items]
  );

  // ========================================================================
  // MODAL OPEN STATE
  // ========================================================================

  const [internalModalOpen, setInternalModalOpen] = useState(false);
  const handleModalChange = useCallback((open: boolean) => {
    setInternalModalOpen(open);
  }, []);

  const [isFlashing, setIsFlashing] = useState(false);
  const prevTickRef = useRef(0);
  useEffect(() => {
    if (filesErrorTick && filesErrorTick !== prevTickRef.current && items.length === 0) {
      prevTickRef.current = filesErrorTick;
      setIsFlashing(true);
    }
  }, [filesErrorTick, items.length]);

  const prevItemsLengthRef = useRef(items.length);
  useEffect(() => {
    const prev = prevItemsLengthRef.current;
    prevItemsLengthRef.current = items.length;
    if (items.length > 0 && prev === 0) {
      handleModalChange(true);
    } else if (items.length === 0 && prev > 0) {
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
    handleModalChange(false);
  }, [items, onDiscardAll, handleModalChange]);

  const handleBulkDelete = useCallback(
    async (selectedCards: GalleryCard[]) => {
      await Promise.all(selectedCards.map(card => onRemove(card.kind, card.id)));
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
          onRemove={context.isSelectionMode ? undefined : (kind, id) => onRemove(kind, id)}
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
  const errorCards = useMemo(
    () => items.filter(card => card.kind === 'uploading' && card.pipelineItem.status === 'error'),
    [items]
  );
  const canProceed = !hasActiveUploads && !hasImporting && completedItems.length > 0 && errorCards.length === 0;

  const handleContinue = useCallback(() => {
    handleModalChange(false);
    onProceed?.(completedItems.length);
  }, [handleModalChange, onProceed, completedItems.length]);

  // ========================================================================
  // RENDER
  // ========================================================================

  const uploadingCount = useMemo(
    () => items.filter(card => card.kind === 'uploading' && ['pending', 'signing', 'uploading', 'saving'].includes(card.pipelineItem.status)).length,
    [items]
  );

  const modal = (
    <Modal
      opened={internalModalOpen && items.length > 0}
      onClose={() => {
        handleModalChange(false);
        if (items.length > 0 && canProceed) onProceed?.(completedItems.length);
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
            toolbar={
              <SelectionToolbar
                selection={selection}
                renderActions={renderActions}
              />
            }
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
              Continue with {completedItems.length} {completedItems.length === 1 ? 'file' : 'files'}
            </Button>
          ) : errorCards.length > 0 ? (
            <Text size="xs" style={{ color: 'var(--mantine-color-orange-4)' }}>
              Remove or retry failed uploads to continue
            </Text>
          ) : null}
        </Group>
      </Group>
    </Modal>
  );

  const photoCount = completedItems.filter(c => c.result?.resource?.resource_type !== 'video').length;
  const videoCount = completedItems.filter(c => c.result?.resource?.resource_type === 'video').length;

  const sectionLabel = (
    <Group px="md" py="sm" justify="space-between">
      {hasActiveUploads ? (
        <Group justify="space-between" style={{ flex: 1 }}>
          <Group gap={6} align="center">
            <Loader size={10} />
            <Text size="xs" c="dimmed">{uploadingCount} uploading</Text>
            {completedItems.length > 0 && (
              <Text size="xs" c="dimmed" style={{ opacity: 0.55 }}>· {completedItems.length} ready</Text>
            )}
          </Group>
          <Text size="xs" c="blue.4" fw={500} style={{ cursor: 'pointer' }} onClick={() => handleModalChange(true)}>View</Text>
        </Group>
      ) : completedItems.length > 0 ? (
        <Group justify="space-between" style={{ flex: 1 }}>
          <Group gap={8} align="center">
            <ThemeIcon size={22} variant="transparent" style={{ color: 'var(--mantine-color-green-5)' }}>
              <IconCheck size={20} />
            </ThemeIcon>
            {photoCount > 0 && (
              <Group gap={3} align="center">
                <ThemeIcon size={22} variant="transparent" style={{ color: 'rgba(255,255,255,0.55)' }}>
                  <IconPhoto size={20} />
                </ThemeIcon>
                <Text size="xs" c="dimmed">{photoCount}</Text>
              </Group>
            )}
            {videoCount > 0 && (
              <Group gap={3} align="center">
                <ThemeIcon size={22} variant="transparent" style={{ color: 'rgba(255,255,255,0.55)' }}>
                  <IconVideo size={20} />
                </ThemeIcon>
                <Text size="xs" c="dimmed">{videoCount}</Text>
              </Group>
            )}
          </Group>
          <Text size="xs" c="blue.4" fw={500} style={{ cursor: 'pointer' }} onClick={() => handleModalChange(true)}>View</Text>
        </Group>
      ) : items.length > 0 ? (
        <Text size="xs" c="red.4">Upload failed</Text>
      ) : null}
    </Group>
  );

  return (
    <>
      {sectionLabel}
      {items.length === 0 && (
        <UploadZone
          onFilesSelected={handleAddFiles}
          onDriveImport={onDriveImport}
          driveLoading={driveLoading}
          flashError={isFlashing}
          onFlashEnd={() => setIsFlashing(false)}
        />
      )}
      {modal}
    </>
  );
});

StepModeModal.displayName = 'StepModeModal';
