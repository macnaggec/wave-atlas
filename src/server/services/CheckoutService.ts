import { createOrder, findPurchasesByBuyer, markOrderFailed, findPurchaseByBuyerAndMedia, findPurchasedItemIds } from 'server/repositories/OrderRepository';
import { findMediaByIds } from 'server/repositories/MediaRepository';
import { MEDIA_STATUS } from 'entities/Media/constants';
import { paymentAdapter } from 'server/lib/payment/activeAdapter';
import { cloudinaryService } from 'server/services/CloudinaryService';
import { BadRequestError, BadGatewayError, ForbiddenError } from 'shared/errors';

type MediaItem = {
  id: string;
  status: string;
  price: number;
  photographerId: string;
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Price validation: prices are always read from DB — never from the client.
 * Items must be PUBLISHED and not already purchased by this buyer.
 */
export async function createCheckoutSession(
  buyerId: string,
  itemIds: string[],
): Promise<{ checkoutUrl: string; orderId: string }> {
  const mediaItems = await fetchAndValidateCartItems(buyerId, itemIds);
  const totalAmount = computeTotal(mediaItems);
  const order = await createOrder({ buyerId, totalAmount, itemIds });
  const checkoutUrl = await openPaymentSession(order.id, mediaItems, totalAmount);

  return { checkoutUrl, orderId: order.id };
}

export async function getPurchases(buyerId: string): Promise<{
  id: string;
  purchasedAt: Date;
  amountPaid: number;
  previewUrl: string | null;
  mediaItem: { id: string; thumbnailUrl: string };
}[]> {
  const purchases = await findPurchasesByBuyer(buyerId);

  return purchases.map((p) => ({
    id: p.id,
    purchasedAt: p.purchasedAt,
    amountPaid: Number(p.amountPaid),
    previewUrl: p.previewUrl ?? null,
    mediaItem: {
      id: p.mediaItem.id,
      thumbnailUrl: p.mediaItem.thumbnailUrl,
    },
  }));
}

/**
 * Verifies the buyer owns the purchase, then generates a short-lived signed
 * Cloudinary download URL for the original media file.
 *
 * Throws ForbiddenError if no Purchase row exists for (buyerId, mediaItemId).
 */
export async function generateDownloadAccess(
  buyerId: string,
  mediaItemId: string,
): Promise<{ downloadUrl: string; expiresAt: number }> {
  const purchase = await findPurchaseByBuyerAndMedia(buyerId, mediaItemId);

  if (!purchase) throw new ForbiddenError('You have not purchased this item');

  return cloudinaryService.generateSignedDownload(purchase.mediaItem.cloudinaryPublicId);
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

async function fetchAndValidateCartItems(
  buyerId: string,
  itemIds: string[]
): Promise<MediaItem[]> {
  if (itemIds.length === 0) throw new BadRequestError('Cart is empty');

  const mediaItems = await findMediaByIds(itemIds);

  if (mediaItems.length !== itemIds.length) {
    throw new BadRequestError('One or more items not found');
  }

  const unpublished = mediaItems.filter((m) => m.status !== MEDIA_STATUS.PUBLISHED);

  if (unpublished.length > 0) {
    throw new BadRequestError(
      `Some items are no longer available: ${unpublished.map((m) => m.id).join(', ')
      }`
    );
  }

  const purchasedIds = await findPurchasedItemIds(buyerId, itemIds);

  if (purchasedIds.length > 0) {
    throw new BadRequestError(
      `Some items already purchased: ${purchasedIds.join(', ')}`,
    );
  }

  return mediaItems;
}

function computeTotal(mediaItems: MediaItem[]): number {
  return mediaItems.reduce((sum, item) => sum + item.price, 0);
}

async function openPaymentSession(
  orderId: string,
  mediaItems: MediaItem[],
  totalAmount: number,
): Promise<string> {
  const appUrl = process.env.APP_URL!;
  const totalCents = Math.round(totalAmount * 100);

  try {
    const { checkoutUrl } = await paymentAdapter.createCheckoutSession({
      orderId,
      itemIds: mediaItems.map((m) => m.id),
      totalCents,
      itemCount: mediaItems.length,
      successUrl: `${appUrl}/me/purchases?order=${orderId}`,
    });

    return checkoutUrl;
  } catch {
    await markOrderFailed(orderId);
    throw new BadGatewayError('Failed to create checkout session');
  }
}
