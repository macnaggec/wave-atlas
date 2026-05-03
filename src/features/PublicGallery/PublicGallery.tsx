import React, { FC, memo, useCallback, useMemo, useState } from 'react';
import { Text, Menu, Group } from '@mantine/core';
import { IconShoppingBag, IconShare } from '@tabler/icons-react';
import { BaseGallery, SelectionToolbar } from 'shared/ui/BaseGallery';
import { DateFilterPopover } from 'shared/ui/DatePickerPopover';
import { MediaItem } from 'entities/Media/types';
import { useGallerySelection, useDateFilter } from 'shared/hooks/gallery';
import { useUser } from 'shared/hooks/useUser';
import PublicCard, { PublicCardAction } from './ui/cards/PublicCard';
import MediaLightbox from './ui/MediaLightbox';
import { usePublicGalleryActions } from './model/usePublicGalleryActions';

const ACTION_ICONS: Record<'cart' | 'share', React.FC<{ size?: number }>> = {
  cart: IconShoppingBag,
  share: IconShare,
};

export interface PublicGalleryProps {
  /** Published media items for this spot */
  items: MediaItem[];

  /** Spot name — used to build the cart item label (e.g. "Uluwatu · Apr 1, 2026") */
  spotName: string;

  /** Set of media IDs currently in the cart — drives active state on cards */
  cartItemIds?: Set<string>;

  /** Called when a card's cart button is clicked (add if not in cart, remove if in cart) */
  onCartToggle?: (item: MediaItem) => void;

  /** Called when user bulk-adds selected items to cart */
  onCartBulkAdd?: (items: MediaItem[]) => void;

  /** Callback when user shares items */
  onShare?: (items: MediaItem[]) => void;

  /**   * Message to display when gallery is empty
   * @default "No media available."
   */
  emptyMessage?: string;
}

/**
 * PublicGallery - Feature for viewing and interacting with published media
 *
 * Business-specific composition of BaseGallery widget with:
 * - PublicCard for media display
 * - Selection support
 * - Cart and share actions (business logic)
 * - Bulk operations via SelectionToolbar
 *
 * This feature handles the business logic for public media interactions:
 * - Spot media viewing (SpotDrawer)
 * - Portfolio displays
 * - Search results
 *
 * For upload/draft management, use UploadGallery feature instead.
 */
const PublicGallery: FC<PublicGalleryProps> = memo(({
  items,
  spotName,
  cartItemIds = new Set<string>(),
  onCartToggle,
  onCartBulkAdd,
  onShare,
  emptyMessage = 'No media available.',
}) => {
  const { getCardActions, getCartBulkState } = usePublicGalleryActions({
    cartItemIds,
    hasShare: !!onShare,
  });
  const { user } = useUser();
  // ========================================================================
  // DATE FILTER
  // ========================================================================

  const getDate = useCallback((m: MediaItem) => m.capturedAt, []);
  const { activeDate, filteredItems, highlightedDates, setDate } = useDateFilter({
    items,
    getDate,
  });

  // ========================================================================
  // SELECTION MANAGEMENT
  // ========================================================================

  const selection = useGallerySelection({
    items: filteredItems,
    getId: (item) => item.id,
  });

  // ========================================================================
  // LIGHTBOX STATE
  // ========================================================================

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const ownedItemIds = useMemo(
    () => new Set(filteredItems.filter(i => i.photographerId === user?.id).map(i => i.id)),
    [filteredItems, user?.id],
  );

  const handleCardClick = useCallback((itemId: string) => {
    const index = filteredItems.findIndex(i => i.id === itemId);
    if (index !== -1) setLightboxIndex(index);
  }, [filteredItems]);

  // ========================================================================
  // ACTION HANDLERS
  // ========================================================================

  const handleCardAction = useCallback((action: PublicCardAction, itemId: string) => {
    const item = filteredItems.find(i => i.id === itemId);
    if (!item) return;
    if (action === 'cart') onCartToggle?.(item);
    if (action === 'share') onShare?.([item]);
  }, [filteredItems, onCartToggle, onShare]);

  const renderMenuActions = useCallback((selectedItems: MediaItem[]) => {
    const { actions, noActionsLabel } = getCartBulkState(selectedItems);

    return (
      <>
        {actions.map(({ key, label, payload }) => {
          const Icon = ACTION_ICONS[key];
          return (
            <Menu.Item key={key} leftSection={<Icon size={14} />}
              onClick={() => {
                if (key === 'cart') onCartBulkAdd?.(payload);
                if (key === 'share') onShare?.(payload);
                selection.disableSelectionMode();
              }}>
              {label}
            </Menu.Item>
          );
        })}
        {actions.length === 0 && (
          <Menu.Item disabled>{noActionsLabel}</Menu.Item>
        )}
      </>
    );
  }, [getCartBulkState, onCartBulkAdd, onShare, selection]);

  // ========================================================================
  // RENDER
  // ========================================================================

  if (items.length === 0) {
    return <Text c="dimmed" fs="italic">{emptyMessage}</Text>;
  }

  return (
    <>
      <BaseGallery
        items={filteredItems}
        selection={selection}
        renderCard={(item, context) => {
          const {
            actions,
            activeActions,
            isOwn,
          } = getCardActions(item, context.isSelectionMode);

          return (
            <PublicCard
              mediaItem={item}
              actions={actions}
              activeActions={activeActions}
              onAction={handleCardAction}
              onCardClick={context.isSelectionMode ? undefined : handleCardClick}
              showOwnerBadge={isOwn}
            />
          );
        }}
        emptyState={<Text c="dimmed" fs="italic">No photos on this date.</Text>}
        toolbar={
          <Group justify="space-between" w="100%">
            <DateFilterPopover
              value={activeDate}
              onChange={setDate}
              highlightedDates={highlightedDates}
              maxDate={new Date()}
            />
            <SelectionToolbar
              selection={selection}
              renderActions={renderMenuActions}
            />
          </Group>
        }
      />

      <MediaLightbox
        items={filteredItems}
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
