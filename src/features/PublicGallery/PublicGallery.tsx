import React, { FC, memo, useCallback, useMemo, useState } from 'react';
import { Text, Menu, Group, SimpleGrid, Skeleton } from '@mantine/core';
import { IconShoppingBag, IconShare } from '@tabler/icons-react';
import { SelectionToolbar } from 'shared/ui/BaseGallery';
import { MediaItem, SpotMediaItem } from 'entities/Media/types';
import { useGallerySelection } from 'shared/hooks/gallery';
import { useSpotMediaFeed } from 'entities/Spot/model/useSpotMediaFeed';
import { buildGalleryRows } from 'shared/lib/buildGalleryRows';
import { VirtualGallery } from 'shared/ui/VirtualGallery/VirtualGallery';
import PublicCard, { PublicCardAction } from './ui/cards/PublicCard';
import MediaLightbox from './ui/MediaLightbox';
import { usePublicGalleryActions } from './model/usePublicGalleryActions';

const ACTION_ICONS: Record<'cart' | 'share', React.FC<{ size?: number }>> = {
  cart: IconShoppingBag,
  share: IconShare,
};

export interface PublicGalleryProps {
  /** Spot ID — used to fetch paginated media */
  spotId: string;

  /** Set of media IDs currently in the cart — drives active state on cards */
  cartItemIds?: Set<string>;

  /** Called when a card's cart button is clicked (add if not in cart, remove if in cart) */
  onCartToggle?: (item: MediaItem) => void;

  /** Called when user bulk-adds selected items to cart */
  onCartBulkAdd?: (items: MediaItem[]) => void;

  /** Callback when user shares items */
  onShare?: (items: MediaItem[]) => void;

  /**
   * Message to display when gallery is empty
   * @default "No media available."
   */
  emptyMessage?: string;
}

const PublicGallery: FC<PublicGalleryProps> = memo(({
  spotId,
  cartItemIds = new Set<string>(),
  onCartToggle,
  onCartBulkAdd,
  onShare,
  emptyMessage = 'No media available.',
}) => {
  const { flatItems, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useSpotMediaFeed(spotId);

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
  // VIRTUAL ROWS + FAST-SCROLL HIGHLIGHTS
  // ========================================================================

  const [expandedDate, setExpandedDate] = useState<Date | null>(null);

  const rows = useMemo(
    () => buildGalleryRows(flatItems, 3, expandedDate),
    [flatItems, expandedDate],
  );

  const highlights = useMemo(
    () =>
      rows
        .map((row, i) => (row.type === 'divider' ? { date: row.date, rowIndex: i } : null))
        .filter((h): h is { date: Date; rowIndex: number } => h !== null),
    [rows],
  );

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

  const handleCardAction = useCallback(
    (action: PublicCardAction, itemId: string) => {
      const item = flatItems.find((i) => i.id === itemId);
      if (!item) return;
      if (action === 'cart') onCartToggle?.(item);
      if (action === 'share') onShare?.([item]);
    },
    [flatItems, onCartToggle, onShare],
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
                  if (key === 'cart') onCartBulkAdd?.(payload);
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
    [getCartBulkState, onCartBulkAdd, onShare, selection],
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
      <div style={{ flex: 1, minHeight: 0, height: '100%' }}>
        <VirtualGallery
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
          highlights={highlights}
          expandedDate={expandedDate}
          onDateExpand={setExpandedDate}
          onEndReached={hasNextPage ? fetchNextPage : undefined}
          isFetchingMore={isFetchingNextPage}
        />
      </div>

      <MediaLightbox
        items={flatItems}
        initialIndex={lightboxIndex ?? 0}
        opened={lightboxIndex !== null}
        onClose={() => setLightboxIndex(null)}
        cartItemIds={cartItemIds}
        onCartToggle={onCartToggle}
        ownedItemIds={ownedItemIds}
      />
    </>
  );
});

PublicGallery.displayName = 'PublicGallery';

export default PublicGallery;
