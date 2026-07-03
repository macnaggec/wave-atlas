import { useCallback } from 'react';
import type { PublicMediaItem } from 'entities/Media';
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
  isPurchased: boolean;
}

export interface BulkAction {
  key: 'cart' | 'share';
  label: string;
  payload: PublicMediaItem[];
}

interface CartBulkState {
  /** Ordered list of available bulk actions for the current selection */
  actions: BulkAction[];
  /** Explains why no actions are available, or null when actions exist */
  noActionsLabel: string | null;
}

type EmptyReason = 'all-own' | 'all-purchased' | 'all-in-cart' | 'mixed-blocked' | null;

const EMPTY_LABELS: Record<NonNullable<EmptyReason>, string> = {
  'all-own': 'All selected items are yours',
  'all-purchased': 'All selected items are already purchased',
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
  const { user, isLoading } = useUser();

  const isOwnId = useCallback(
    (photographerId: string) => isLoading || photographerId === user?.id,
    [user?.id, isLoading],
  );

  const getCardActions = useCallback(
    (item: PublicMediaItem, isSelectionMode: boolean): CardActionResult => {
      // While session loads, treat items as non-interactive to avoid briefly
      // showing cart buttons on own items before user identity is known.
      const isOwn = isOwnId(item.photographerId);
      const isPurchased = item.viewerEntitlement.purchaseState === 'purchased';
      if (isSelectionMode || isOwn || isPurchased) {
        return { actions: ACTIONS_NONE, activeActions: ACTIONS_NONE, isOwn, isPurchased };
      }
      return {
        actions: hasShare ? ACTIONS_CART_SHARE : ACTIONS_CART,
        activeActions: cartItemIds.has(item.id) ? ACTIVE_CART : ACTIONS_NONE,
        isOwn,
        isPurchased,
      };
    },
    [isOwnId, cartItemIds, hasShare],
  );

  const getCartBulkState = useCallback(
    (selectedItems: PublicMediaItem[]): CartBulkState => {
      const buyableItems = selectedItems.filter((i) =>
        !isOwnId(i.photographerId) && i.viewerEntitlement.purchaseState !== 'purchased'
      );
      const toAddItems = buyableItems.filter((i) => !cartItemIds.has(i.id));

      const counts = {
        total: selectedItems.length,
        buyable: buyableItems.length,
        toAdd: toAddItems.length,
        own: selectedItems.filter((i) => isOwnId(i.photographerId)).length,
        purchased: selectedItems.filter((i) => i.viewerEntitlement.purchaseState === 'purchased').length,
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
          [counts.purchased === counts.total, 'all-purchased'],
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
    [isOwnId, cartItemIds, hasShare],
  );

  return { getCardActions, getCartBulkState, isOwnId, userId: user?.id };
}
