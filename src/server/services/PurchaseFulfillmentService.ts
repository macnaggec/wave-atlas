import { findOrderByExternalId, findOrderById, fulfill } from 'server/repositories/OrderRepository';
import { findMediaByIdsForFulfillment } from 'server/repositories/MediaRepository';
import { cloudinaryService } from 'server/services/CloudinaryService';

const PLATFORM_FEE_RATE = 0.20;
const PHOTOGRAPHER_RATE = 0.80;

/**
 * Fulfills an order after payment confirmation.
 * Idempotent: exits early if externalOrderId already recorded.
 */
export async function fulfillOrder(
  orderId: string,
  externalOrderId: string
): Promise<void> {
  const existing = await findOrderByExternalId(externalOrderId);
  if (existing) return;

  const order = await findOrderById(orderId);
  if (!order) return;

  // itemIds come from OrderItem rows — not trusted from the external webhook payload
  const itemIds = order.items.map((item) => item.mediaItemId);
  const mediaItems = await findMediaByIdsForFulfillment(itemIds);

  const purchases = mediaItems.map((item) => ({
    mediaItemId: item.id,
    buyerId: order.buyerId,
    amountPaid: item.price,
    platformFee: item.price * PLATFORM_FEE_RATE,
    photographerEarned: item.price * PHOTOGRAPHER_RATE,
    previewUrl: cloudinaryService.tryGeneratePermanentPreviewUrl(item.cloudinaryPublicId),
  }));

  const earningsMap = new Map<string, number>();
  for (const item of mediaItems) {
    earningsMap.set(
      item.photographerId,
      (earningsMap.get(item.photographerId) ?? 0) + item.price * PHOTOGRAPHER_RATE,
    );
  }

  await fulfill(orderId, externalOrderId, purchases, earningsMap);
}
