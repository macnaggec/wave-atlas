import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Center, Select, SimpleGrid, Skeleton, Text, Menu, Group, rem } from '@mantine/core';
import { IconFilter, IconTrash, IconEyeOff } from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTRPC } from 'app/lib/trpc';
import { useDeleteMedia } from 'entities/Media/model/useDeleteMedia';
import { BaseGallery, SelectionToolbar } from 'shared/ui/BaseGallery';
import { useGallerySelection } from 'shared/hooks/gallery';
import { DateEditPopover, PriceEditPopover } from 'features/Upload/ui/popovers';
import { MIN_MEDIA_PRICE_CENTS } from 'entities/Media/constants';
import { notify } from 'shared/lib/notifications';
import { getErrorMessage } from 'shared/lib/getErrorMessage';
import { DraftsDropdown } from 'features/Upload/ui/DraftsDropdown';
import { PublishedCard } from 'features/Upload/ui/cards/PublishedCard';
import { OwnerLightbox } from 'features/Upload/ui/OwnerLightbox';

export const Route = createFileRoute('/_drawer/me/')({
  component: UploadsTab,
});

// ============================================================================
// UPLOADS TAB
// ============================================================================

function UploadsTab() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { mutateAsync: deleteMedia } = useDeleteMedia();

  const { data: uploads = [], isLoading: uploadsLoading } = useQuery(
    trpc.users.myUploads.queryOptions(),
  );

  const { data: draftCounts = [] } = useQuery(
    trpc.users.myDraftCounts.queryOptions(),
  );

  // ========================================================================
  // SPOT FILTER
  // ========================================================================

  const [spotFilter, setSpotFilter] = useState<string | null>(null);

  const spots = useMemo(() => {
    const seen = new Map<string, string>();
    for (const u of uploads) {
      if (!seen.has(u.spotId)) seen.set(u.spotId, u.spotName ?? u.spotId);
    }
    return Array.from(seen.entries()).map(([value, label]) => ({ value, label }));
  }, [uploads]);

  const visibleUploads = useMemo(
    () => spotFilter ? uploads.filter((u) => u.spotId === spotFilter) : uploads,
    [uploads, spotFilter],
  );

  // ========================================================================
  // SELECTION
  // ========================================================================

  const selection = useGallerySelection({
    items: visibleUploads,
    getId: (item) => item.id,
  });
  const { disableSelectionMode, deselectItems } = selection;

  useEffect(() => {
    disableSelectionMode();
    setLightboxIndex(null);
  }, [spotFilter, disableSelectionMode]);

  // ========================================================================
  // LIGHTBOX
  // ========================================================================

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // ========================================================================
  // METADATA STATE (toolbar bulk edit)
  // ========================================================================

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedPrice, setSelectedPrice] = useState<number>(MIN_MEDIA_PRICE_CENTS / 100);

  const getTargetIds = useCallback((): string[] => {
    return [...selection.selectedIds];
  }, [selection.selectedIds]);

  // ========================================================================
  // MUTATIONS
  // ========================================================================

  const { mutateAsync: updatePublishedBatch } = useMutation(
    trpc.media.updatePublishedBatch.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: trpc.users.myUploads.queryKey() });
      },
      onError: (err) => {
        notify.error(getErrorMessage(err), 'Update Failed');
      },
    }),
  );

  const { mutateAsync: unpublishBatch } = useMutation(
    trpc.media.unpublishBatch.mutationOptions({
      onSuccess: (_, { mediaIds }) => {
        void queryClient.invalidateQueries({ queryKey: trpc.users.myUploads.queryKey() });
        void queryClient.invalidateQueries({ queryKey: trpc.users.myDraftCounts.queryKey() });
        notify.success(`Moved ${mediaIds.length} item(s) back to drafts`, 'Unpublished');
      },
      onError: (err) => {
        notify.error(getErrorMessage(err), 'Unpublish Failed');
      },
    }),
  );

  // ========================================================================
  // HANDLERS
  // ========================================================================

  const handleBulkDateEdit = useCallback(async (date: Date) => {
    const mediaIds = getTargetIds();
    if (mediaIds.length === 0) return;
    setSelectedDate(date);
    try {
      await updatePublishedBatch({ mediaIds, capturedAt: date });
      notify.success(`Updated date for ${mediaIds.length} item(s)`, 'Date Updated');
    } catch {
      // error notification handled by mutation onError
    }
  }, [getTargetIds, updatePublishedBatch]);

  const handleBulkPriceEdit = useCallback(async (price: number) => {
    const mediaIds = getTargetIds();
    if (mediaIds.length === 0) return;
    setSelectedPrice(price);
    try {
      await updatePublishedBatch({ mediaIds, price: Math.round(price * 100) });
      notify.success(`Updated price for ${mediaIds.length} item(s)`, 'Price Updated');
    } catch {
      // error notification handled by mutation onError
    }
  }, [getTargetIds, updatePublishedBatch]);

  const handleLightboxUpdate = useCallback(async (id: string, update: { price?: number; capturedAt?: Date }) => {
    const field = update.price !== undefined ? 'Price' : 'Date';
    try {
      await updatePublishedBatch({ mediaIds: [id], ...update });
      notify.success(`${field} updated`, `${field} Updated`);
    } catch {
      // error notification handled by mutation onError
    }
  }, [updatePublishedBatch]);

  const handleBulkDelete = useCallback(
    async (selectedItems: typeof uploads) => {
      const results = await Promise.allSettled(
        selectedItems.map((item) => deleteMedia({ id: item.id })),
      );
      const succeededIds = selectedItems
        .filter((_, i) => results[i].status === 'fulfilled')
        .map((item) => item.id);
      deselectItems(succeededIds);
    },
    [deleteMedia, deselectItems],
  );

  const handleBulkUnpublish = useCallback(
    async (selectedItems: typeof uploads) => {
      const mediaIds = selectedItems.map((item) => item.id);
      await unpublishBatch({ mediaIds });
      disableSelectionMode();
    },
    [unpublishBatch, disableSelectionMode],
  );

  // ========================================================================
  // RENDER ACTIONS
  // ========================================================================

  const renderActions = useCallback(
    (selectedItems: typeof uploads) => (
      <>
        <Menu.Item
          leftSection={<IconEyeOff style={{ width: rem(14), height: rem(14) }} />}
          onClick={() => handleBulkUnpublish(selectedItems)}
        >
          Unpublish {selectedItems.length} {selectedItems.length === 1 ? 'item' : 'items'}
        </Menu.Item>
        <Menu.Item
          color="red"
          leftSection={<IconTrash style={{ width: rem(14), height: rem(14) }} />}
          onClick={() => handleBulkDelete(selectedItems)}
        >
          Delete {selectedItems.length} {selectedItems.length === 1 ? 'item' : 'items'}
        </Menu.Item>
      </>
    ),
    [handleBulkUnpublish, handleBulkDelete],
  );

  // ========================================================================
  // RENDER
  // ========================================================================

  if (uploadsLoading) {
    return (
      <SimpleGrid cols={3} spacing={10} mt="md">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} height={120} radius="sm" />
        ))}
      </SimpleGrid>
    );
  }

  if (uploads.length === 0) {
    return (
      <Center mih={200}>
        <Text c="dimmed" size="sm">No published uploads yet.</Text>
      </Center>
    );
  }

  return (
    <>
      <BaseGallery
        items={visibleUploads}
        selection={selection}
        toolbar={
          <Group gap="md" justify="space-between" w="100%">
            <Group gap="md">
              {spots.length > 1 && (
                <Select
                  placeholder="All spots"
                  data={spots}
                  value={spotFilter}
                  onChange={setSpotFilter}
                  clearable
                  size="xs"
                  w={160}
                  leftSection={<IconFilter size={14} />}
                />
              )}
              {draftCounts.length > 0 && <DraftsDropdown spots={draftCounts} />}
              <DateEditPopover
                value={selectedDate}
                selectedCount={selection.selectedCount}
                onApply={handleBulkDateEdit}
                disabled={!selection.hasSelection}
                tooltip="Select items to edit"
              />
              <PriceEditPopover
                value={selectedPrice}
                selectedCount={selection.selectedCount}
                onApply={handleBulkPriceEdit}
                disabled={!selection.hasSelection}
                tooltip="Select items to edit"
              />
            </Group>
            <SelectionToolbar selection={selection} renderActions={renderActions} />
          </Group>
        }
        renderCard={(item, context) => (
          <PublishedCard
            item={item}
            onClick={!context.isSelectionMode ? () => setLightboxIndex(context.index) : undefined}
          />
        )}
      />

      {lightboxIndex !== null && (
        <OwnerLightbox
          items={visibleUploads}
          initialIndex={lightboxIndex}
          opened
          onClose={() => setLightboxIndex(null)}
          onUpdate={handleLightboxUpdate}
        />
      )}
    </>
  );
}
