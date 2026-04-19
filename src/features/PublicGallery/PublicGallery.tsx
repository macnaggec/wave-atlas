import React, { FC, memo, useCallback, useMemo, useState } from 'react';
import { Text, Menu, Group } from '@mantine/core';
import { IconShoppingBag, IconShare } from '@tabler/icons-react';
import { BaseGallery, SelectionToolbar } from 'shared/ui/BaseGallery';
import { DateFilterPopover } from 'shared/ui/DatePickerPopover';
import { MediaItem } from 'entities/Media/types';
import { useGallerySelection, useDateFilter } from 'shared/hooks/gallery';
import PublicCard, { PublicCardAction } from './ui/cards/PublicCard';
import MediaLightbox from './ui/MediaLightbox';

const ACTIONS_CART: PublicCardAction[] = ['cart'];
const ACTIONS_CART_SHARE: PublicCardAction[] = ['cart', 'share'];
const ACTIONS_NONE: PublicCardAction[] = [];
const ACTIVE_CART: PublicCardAction[] = ['cart'];

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

  /**
   * Message to display when gallery is empty
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
 *
 * @example
 * ```tsx
 * <PublicGallery
 *   items={spotMedia}
 *   onAddToCart={(items) => addToCart(items)}
 *   onShare={(items) => shareMedia(items)}
 * />
 * ```
 */
const PublicGallery: FC<PublicGalleryProps> = memo(({
  items,
  spotName,
  cartItemIds = new Set(),
  onCartToggle,
  onCartBulkAdd,
  onShare,
  emptyMessage = 'No media available.',
}) => {
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

  const handleCardClick = useCallback((itemId: string) => {
    const index = filteredItems.findIndex(i => i.id === itemId);
    if (index !== -1) setLightboxIndex(index);
  }, [filteredItems]);

  const handleLightboxClose = useCallback(() => {
    setLightboxIndex(null);
  }, []);

  // ========================================================================
  // ACTION HANDLERS
  // ========================================================================

  const handleShare = useCallback((selectedItems: MediaItem[]) => {
    onShare?.(selectedItems);
  }, [onShare]);

  // Single card action handler
  const handleCardAction = useCallback((action: PublicCardAction, itemId: string) => {
    const item = filteredItems.find(i => i.id === itemId);
    if (!item) return;
    if (action === 'cart') onCartToggle?.(item);
    if (action === 'share') handleShare([item]);
  }, [filteredItems, onCartToggle, handleShare]);

  // Memoized menu actions for bulk operations
  const renderMenuActions = useCallback((selectedItems: MediaItem[]) => (
    <>
      <Menu.Item
        leftSection={<IconShoppingBag size={14} />}
        onClick={() => { onCartBulkAdd?.(selectedItems); selection.disableSelectionMode(); }}>
        Add {selectedItems.length} to cart
      </Menu.Item>
      {onShare && (
        <Menu.Item
          leftSection={<IconShare size={14} />}
          onClick={() => { handleShare(selectedItems); selection.disableSelectionMode(); }}>
          Share {selectedItems.length} {selectedItems.length === 1 ? 'item' : 'items'}
        </Menu.Item>
      )}
    </>
  ), [onShare, onCartBulkAdd, handleShare, selection]);

  // ========================================================================
  // RENDER
  // ========================================================================

  if (items.length === 0) {
    return <Text c="dimmed" fs="italic">{emptyMessage}</Text>;
  }

  // Calculate available actions based on provided callbacks
  const availableActions = useMemo(
    () => onShare ? ACTIONS_CART_SHARE : ACTIONS_CART,
    [onShare]
  );

  return (
    <>
      <BaseGallery
        items={filteredItems}
        selection={selection}
        renderCard={(item, context) => (
          <PublicCard
            mediaItem={item}
            actions={context.isSelectionMode ? ACTIONS_NONE : availableActions}
            activeActions={context.isSelectionMode ? ACTIONS_NONE : (cartItemIds.has(item.id) ? ACTIVE_CART : ACTIONS_NONE)}
            onAction={handleCardAction}
            onCardClick={context.isSelectionMode ? undefined : handleCardClick}
          />
        )}
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
        onClose={handleLightboxClose}
        spotName={spotName}
      />
    </>
  );
});

PublicGallery.displayName = 'PublicGallery';

export default PublicGallery;
