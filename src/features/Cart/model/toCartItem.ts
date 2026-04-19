import { MediaItem } from 'entities/Media/types';
import { CartItem } from 'features/Cart/model/types';

/**
 * Pure mapper: converts a MediaItem + spot name into a domain-agnostic CartItem.
 * Used by useCartItem (single item) and directly by galleries (bulk add).
 */
export function toCartItem(item: MediaItem, spotName: string): CartItem {
  const date = new Date(item.capturedAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return {
    id: item.id,
    label: `${spotName} · ${date}`,
    thumbnailUrl: item.thumbnailUrl,
    priceCents: item.price,
  };
}
