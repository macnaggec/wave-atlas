import React, { FC, memo, useCallback, useMemo, useRef, useState } from 'react';
import { Text, Menu, Group, SimpleGrid, Skeleton } from '@mantine/core';
import { IconShoppingBag, IconShare } from '@tabler/icons-react';
import { SelectionToolbar } from 'shared/ui/BaseGallery';
import { MediaItem, SpotMediaItem } from 'entities/Media';
import { useGallerySelection } from 'shared/hooks/gallery';
import { useSpotMediaFeed, useSpotPreview } from 'entities/Spot';
import { buildGalleryRows } from 'shared/lib/buildGalleryRows';
import { VirtualGallery, type VirtualGalleryHandle } from 'shared/ui/VirtualGallery/VirtualGallery';
import { useCartStore, toCartItem } from 'entities/Commerce';
import PublicCard, { PublicCardAction } from './ui/cards/PublicCard';
import MediaLightbox, { LightboxMedia } from './ui/MediaLightbox';
import { GalleryDateSidebar } from './ui/GalleryDateSidebar';
import { usePublicGalleryActions } from './model/usePublicGalleryActions';

const ACTION_ICONS: Record<'cart' | 'share', React.FC<{ size?: number }>> = {
  cart: IconShoppingBag,
  share: IconShare,
};

export interface PublicGalleryProps {
  spotId: string;
  onShare?: (items: MediaItem[]) => void;
  emptyMessage?: string;
}

const PublicGallery: FC<PublicGalleryProps> = memo(({
  spotId,
  onShare,
  emptyMessage = 'No media available.',
}) => {
  const { flatItems, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useSpotMediaFeed(spotId);

  const { data: spot } = useSpotPreview(spotId);
  const spotName = spot?.name ?? '';

  const cartStoreItems = useCartStore((s) => s.items);
  const addToCart = useCartStore((s) => s.add);
  const removeFromCart = useCartStore((s) => s.remove);

  const cartItemIds = useMemo(
    () => new Set(cartStoreItems.map((i) => i.id)),
    [cartStoreItems],
  );

  const { getCardActions, getCartBulkState, userId } = usePublicGalleryActions({
    cartItemIds,
    hasShare: !!onShare,
  });

  // ========================================================================
  // SELECTION
  // ========================================================================

  const selection = useGallerySelection({
    items: flatItems,
    getId: (item) => item.id,
  });

  // ========================================================================
  // LIGHTBOX STATE
  // ========================================================================

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const ownedItemIds = useMemo(
    () => new Set(flatItems.filter((i) => i.photographerId === userId).map((i) => i.id)),
    [flatItems, userId],
  );

  // ========================================================================
  // VIRTUAL ROWS + SIDEBAR
  // ========================================================================

  const rows = useMemo(() => buildGalleryRows(flatItems, 3), [flatItems]);

  const highlights = useMemo(
    () =>
      rows
        .map((row, i) => (row.type === 'divider' ? { date: row.date, rowIndex: i } : null))
        .filter((h): h is { date: Date; rowIndex: number } => h !== null),
    [rows],
  );

  const galleryRef = useRef<VirtualGalleryHandle>(null);
  const [firstVisibleIndex, setFirstVisibleIndex] = useState(0);

  // ========================================================================
  // ACTION HANDLERS
  // ========================================================================

  const handleCardClick = useCallback(
    (itemId: string) => {
      const index = flatItems.findIndex((i) => i.id === itemId);
      if (index !== -1) setLightboxIndex(index);
    },
    [flatItems],
  );

  const handleCartToggle = useCallback(
    (lightboxItem: LightboxMedia) => {
      if (cartItemIds.has(lightboxItem.id)) {
        removeFromCart(lightboxItem.id);
      } else {
        const full = flatItems.find((i) => i.id === lightboxItem.id);
        if (full) addToCart(toCartItem(full, spotName));
      }
    },
    [cartItemIds, removeFromCart, addToCart, flatItems, spotName],
  );

  const handleCardAction = useCallback(
    (action: PublicCardAction, itemId: string) => {
      const item = flatItems.find((i) => i.id === itemId);
      if (!item) return;
      if (action === 'cart') handleCartToggle(item);
      if (action === 'share') onShare?.([item]);
    },
    [flatItems, handleCartToggle, onShare],
  );

  const renderMenuActions = useCallback(
    (selectedItems: SpotMediaItem[]) => {
      const { actions, noActionsLabel } = getCartBulkState(selectedItems);
      return (
        <>
          {actions.map(({ key, label, payload }) => {
            const Icon = ACTION_ICONS[key];
            return (
              <Menu.Item
                key={key}
                leftSection={<Icon size={14} />}
                onClick={() => {
                  if (key === 'cart') payload.forEach((item) => addToCart(toCartItem(item, spotName)));
                  if (key === 'share') onShare?.(payload);
                  selection.disableSelectionMode();
                }}
              >
                {label}
              </Menu.Item>
            );
          })}
          {actions.length === 0 && <Menu.Item disabled>{noActionsLabel}</Menu.Item>}
        </>
      );
    },
    [getCartBulkState, addToCart, spotName, onShare, selection],
  );

  // ========================================================================
  // RENDER
  // ========================================================================

  if (isLoading) {
    return (
      <SimpleGrid cols={3} spacing={10} mt="md">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} height={120} radius="sm" />
        ))}
      </SimpleGrid>
    );
  }

  if (flatItems.length === 0) {
    return <Text c="dimmed" fs="italic">{emptyMessage}</Text>;
  }

  return (
    <>
      <div style={{ flex: 1, minHeight: 0, height: '100%', display: 'flex', gap: 4 }}>
        <VirtualGallery
          ref={galleryRef}
          rows={rows}
          selection={selection}
          toolbar={
            <Group justify="flex-end">
              <SelectionToolbar selection={selection} renderActions={renderMenuActions} />
            </Group>
          }
          renderCard={(item, context) => {
            const { actions, activeActions, isOwn } = getCardActions(item, context.isSelectionMode);
            return (
              <PublicCard
                mediaItem={item as SpotMediaItem}
                actions={actions}
                activeActions={activeActions}
                onAction={handleCardAction}
                onCardClick={context.isSelectionMode ? undefined : handleCardClick}
                showOwnerBadge={isOwn}
              />
            );
          }}
          onFirstVisibleIndexChange={setFirstVisibleIndex}
          onEndReached={hasNextPage ? fetchNextPage : undefined}
          isFetchingMore={isFetchingNextPage}
        />
        <GalleryDateSidebar
          highlights={highlights}
          firstVisibleIndex={firstVisibleIndex}
          galleryRef={galleryRef}
        />
      </div>

      <MediaLightbox
        items={flatItems}
        initialIndex={lightboxIndex ?? 0}
        opened={lightboxIndex !== null}
        onClose={() => setLightboxIndex(null)}
        cartItemIds={cartItemIds}
        onCartToggle={handleCartToggle}
        ownedItemIds={ownedItemIds}
      />
    </>
  );
});

PublicGallery.displayName = 'PublicGallery';

export default PublicGallery;
