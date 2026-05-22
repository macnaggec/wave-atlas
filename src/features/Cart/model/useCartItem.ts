import { useCallback } from 'react';
import { MediaItem } from 'entities/Media/types';
import { useCartStore } from 'features/Cart/model/cartStore';
import { CartItem } from 'features/Cart/model/types';
import { formatShortDate } from 'shared/lib/dateUtils';

/**
 * Pure mapper: converts a MediaItem + spot name into a domain-agnostic CartItem.
 * Used by useCartItem (single item) and directly by galleries (bulk add).
 */
export function toCartItem(item: MediaItem, spotName: string): CartItem {
  const capturedAt = item.capturedAt instanceof Date
    ? item.capturedAt.toISOString()
    : String(item.capturedAt);
  return {
    id: item.id,
    label: `${spotName} · ${formatShortDate(capturedAt)}`,
    spotName,
    capturedAt,
    thumbnailUrl: item.thumbnailUrl,
    lightboxUrl: item.lightboxUrl,
    priceCents: item.price,
  };
}

/**
 * Maps a MediaItem to a domain-agnostic CartItem and binds cart actions.
 * This is the only place that knows both MediaItem shape and CartItem shape.
 */
export function useCartItem(item: MediaItem, spotName: string) {
  const add = useCartStore((s) => s.add);
  const remove = useCartStore((s) => s.remove);
  const isInCart = useCartStore((s) => s.items.some((i) => i.id === item.id));

  const addToCart = useCallback(() => {
    add(toCartItem(item, spotName));
  }, [add, item, spotName]);

  const removeFromCart = useCallback(() => {
    remove(item.id);
  }, [remove, item.id]);

  return { isInCart, addToCart, removeFromCart };
}
