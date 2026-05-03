import { useCallback } from 'react';
import { MediaItem } from 'entities/Media/types';
import { useUser } from 'shared/hooks/useUser';
import type { PublicCardAction } from './types';

const ACTIONS_CART: PublicCardAction[] = ['cart'];
const ACTIONS_CART_SHARE: PublicCardAction[] = ['cart', 'share'];
const ACTIONS_NONE: PublicCardAction[] = [];
const ACTIVE_CART: PublicCardAction[] = ['cart'];

interface CardActionResult {
  actions: PublicCardAction[];
  activeActions: PublicCardAction[];
  isOwn: boolean;
}

export interface BulkAction {
  key: 'cart' | 'share';
  label: string;
  payload: MediaItem[];
}

interface CartBulkState {
  /** Ordered list of available bulk actions for the current selection */
  actions: BulkAction[];
  /** Explains why no actions are available, or null when actions exist */
  noActionsLabel: string | null;
}

type EmptyReason = 'all-own' | 'all-in-cart' | 'mixed-blocked' | null;

const EMPTY_LABELS: Record<NonNullable<EmptyReason>, string> = {
  'all-own': 'All selected items are yours',
  'all-in-cart': 'All selected already in cart',
  'mixed-blocked': 'No purchasable items selected',
};

interface UsePublicGalleryActionsParams {
  cartItemIds: Set<string>;
  hasShare: boolean;
}

/**
 * Encapsulates all per-item permission and action logic for PublicGallery.
 *
 * Single source of truth for:
 * - Which actions are available on a card (cart, share, none)
 * - Which actions are active (item in cart)
 * - Which items are buyable (excludes own media)
 *
 * Keeps PublicGallery body free of user/ownership checks.
 */
export function usePublicGalleryActions({
  cartItemIds,
  hasShare
}: UsePublicGalleryActionsParams) {
  const { user } = useUser();

  const getCardActions = useCallback(
    (item: MediaItem, isSelectionMode: boolean): CardActionResult => {
      const isOwn = item.photographerId === user?.id;
      if (isSelectionMode || isOwn) {
        return { actions: ACTIONS_NONE, activeActions: ACTIONS_NONE, isOwn };
      }
      return {
        actions: hasShare ? ACTIONS_CART_SHARE : ACTIONS_CART,
        activeActions: cartItemIds.has(item.id) ? ACTIVE_CART : ACTIONS_NONE,
        isOwn,
      };
    },
    [user?.id, cartItemIds, hasShare],
  );

  const getBuyableItems = useCallback(
    (items: MediaItem[]): MediaItem[] =>
      items.filter((i) => i.photographerId !== user?.id),
    [user?.id],
  );

  const getCartBulkState = useCallback(
    (selectedItems: MediaItem[]): CartBulkState => {
      const buyableItems = getBuyableItems(selectedItems);
      const toAddItems = buyableItems.filter((i) => !cartItemIds.has(i.id));

      const counts = {
        total: selectedItems.length,
        buyable: buyableItems.length,
        toAdd: toAddItems.length,
        own: selectedItems.length - buyableItems.length,
        alreadyInCart: buyableItems.length - toAddItems.length,
      };

      const actions: BulkAction[] = [];

      if (counts.toAdd > 0) {
        const label = counts.toAdd < counts.total
          ? `Add ${counts.toAdd} of ${counts.total} to cart`
          : `Add ${counts.toAdd} to cart`;
        actions.push({ key: 'cart', label, payload: toAddItems });
      }

      if (hasShare) {
        const n = selectedItems.length;
        actions.push({ key: 'share', label: `Share ${n} ${n === 1 ? 'item' : 'items'}`, payload: selectedItems });
      }

      const EMPTY_REASONS: Array<
        [condition: boolean, reason: NonNullable<EmptyReason>]
      > = [
          [counts.own === counts.total, 'all-own'],
          [counts.alreadyInCart === counts.buyable, 'all-in-cart'],
          [true, 'mixed-blocked'],
        ];
      const emptyReason: EmptyReason = actions.length > 0
        ? null
        : EMPTY_REASONS.find(([condition]) => condition)![1];

      return {
        actions,
        noActionsLabel: emptyReason ? EMPTY_LABELS[emptyReason] : null,
      };
    },
    [getBuyableItems, cartItemIds, hasShare],
  );

  return { getCardActions, getCartBulkState };
}
