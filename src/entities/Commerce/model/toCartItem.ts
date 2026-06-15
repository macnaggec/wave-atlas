import { MediaItem } from 'entities/Media';
import { formatShortDate } from 'shared/lib/dateUtils';
import { CartItem } from 'entities/Commerce/model/types';

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
    priceCents: item.price ?? 0,
  };
}
