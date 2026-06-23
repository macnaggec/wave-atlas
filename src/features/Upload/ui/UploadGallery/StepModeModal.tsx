import React, { FC, memo, useMemo, useCallback, useRef } from 'react';
import { Box, Button, Divider, Group, Loader, Menu, Modal, rem, Text } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { GalleryCard, getItemId, getUploadQueueStatus } from '../../model';
import { BaseGallery, SelectionToolbar } from 'shared/ui/BaseGallery';
import { UseGallerySelectionReturn } from 'shared/hooks/gallery';
import { UploadCardRenderer } from './UploadCardRenderer';
import { handleFileSelection } from '../../lib/fileSelection';

export interface StepModeModalProps {
  opened: boolean;
  onClose: () => void;
  items: GalleryCard[];
  selection: UseGallerySelectionReturn<GalleryCard>;
  /** Required — ensures Cloudinary cleanup path is never silently dropped. */
  onDiscardAll: () => Promise<void>;
  onRemove: (kind: GalleryCard['kind'], id: string) => Promise<void>;
  onAddFiles?: (files: File[]) => void;
  onRetry?: (id: string) => void;
}

export const StepModeModal: FC<StepModeModalProps> = memo(({
  opened,
  onClose,
  items,
  selection,
  onDiscardAll,
  onRemove,
  onAddFiles,
  onRetry,
}) => {
  const queueStatus = useMemo(() => getUploadQueueStatus(items), [items]);
  const { errorCards, hasActiveUploads, uploadingCount } = queueStatus;

  // ========================================================================
  // FILE HANDLING
  // ========================================================================

  const handleAddFiles = useCallback((files: File[]) => {
    selection.disableSelectionMode();
    onAddFiles?.(files);
  }, [onAddFiles, selection]);

  const addMoreInputRef = useRef<HTMLInputElement>(null);
  const handleAddMoreChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    handleFileSelection(files, handleAddFiles);
  }, [handleAddFiles]);

  // ========================================================================
  // BULK ACTIONS
  // ========================================================================

  const handleCancelAll = useCallback(async () => {
    try {
      await onDiscardAll();
      onClose();
    } catch {
      // Modal stays open; error notification is handled inside discardAll/coordinator.
    }
  }, [onDiscardAll, onClose]);

  const handleBulkDelete = useCallback(
    async (selectedCards: GalleryCard[]) => {
      await Promise.all(selectedCards.map(card => onRemove(card.kind, card.id)));
      selection.clearSelection();
    },
    [onRemove, selection]
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
      const isSaving = card.kind === 'attempt' && card.status === 'FINALIZING';
      const hasDateError = card.kind === 'draft' && !card.result.capturedAt;
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
  // RENDER
  // ========================================================================

  return (
    <Modal
      opened={opened && items.length > 0}
      onClose={onClose}
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
          ) : errorCards.length > 0 ? (
            <Text size="xs" style={{ color: 'var(--mantine-color-orange-4)' }}>
              Remove or retry failed uploads to continue
            </Text>
          ) : null}
          <Button
            variant="transparent" size="xs" radius="xl"
            style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.16)', color: '#fff' }}
            onClick={onClose}
          >
            Close
          </Button>
        </Group>
      </Group>
    </Modal>
  );
});

StepModeModal.displayName = 'StepModeModal';
