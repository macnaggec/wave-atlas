import { MediaItem } from 'entities/Media';
import { formatShortDate } from 'shared/lib/dateUtils';
import { CartItem } from 'entities/Commerce/model/types';

type CartMediaItem = Pick<
  MediaItem,
  'id' | 'capturedAt' | 'thumbnailUrl' | 'lightboxUrl' | 'price'
>;

export function toCartItem(item: CartMediaItem, spotName: string): CartItem {
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
