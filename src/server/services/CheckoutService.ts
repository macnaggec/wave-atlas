import type { IOrderRepository } from 'server/repositories/OrderRepository';
import type { IMediaRepository } from 'server/repositories/MediaRepository';
import type { IPurchaseRepository } from 'server/repositories/PurchaseRepository';
import { orderRepository } from 'server/repositories/OrderRepository';
import { mediaRepository } from 'server/repositories/MediaRepository';
import { purchaseRepository } from 'server/repositories/PurchaseRepository';
import { MEDIA_STATUS } from 'entities/Media/constants';
import type { PaymentAdapter } from 'server/lib/payment/PaymentAdapter';
import { paymentAdapter } from 'server/lib/payment/activeAdapter';
import type { ICloudinaryService } from 'server/services/CloudinaryService';
import { cloudinaryService } from 'server/services/CloudinaryService';
import { BadRequestError, BadGatewayError, ForbiddenError } from 'shared/errors';

export class CheckoutService {
  constructor(
    private orders: IOrderRepository,
    private media: IMediaRepository,
    private purchases: IPurchaseRepository,
    private payment: PaymentAdapter,
    private cloudinary: ICloudinaryService,
  ) { }

  /**
   * Price validation: prices are always read from DB — never from the client.
   * Items must be PUBLISHED and not already purchased by this buyer.
   */
  async createCheckoutSession(
    buyerId: string,
    itemIds: string[],
  ): Promise<{ checkoutUrl: string; orderId: string }> {
    const mediaItems = await this.fetchAndValidateCartItems(buyerId, itemIds);
    const totalAmount = mediaItems.reduce((sum, item) => sum + item.price, 0);
    const order = await this.orders.createOrder({ buyerId, totalAmount, itemIds });
    const checkoutUrl = await this.openPaymentSession(order.id, mediaItems, totalAmount);

    return { checkoutUrl, orderId: order.id };
  }

  async getPurchases(buyerId: string): Promise<{
    id: string;
    purchasedAt: Date;
    amountPaid: number;
    previewUrl: string | null;
    mediaItem: { id: string; thumbnailUrl: string };
  }[]> {
    const purchases = await this.purchases.findByBuyer(buyerId);

    return purchases.map((p) => ({
      id: p.id,
      purchasedAt: p.purchasedAt,
      amountPaid: p.amountPaid,
      previewUrl: p.previewUrl,
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
  async generateDownloadAccess(
    buyerId: string,
    mediaItemId: string,
  ): Promise<{ downloadUrl: string; expiresAt: number }> {
    const purchase = await this.purchases.findByBuyerAndMedia(buyerId, mediaItemId);

    if (!purchase) throw new ForbiddenError('You have not purchased this item');

    return this.cloudinary.generateSignedDownload(purchase.mediaItem.cloudinaryPublicId);
  }

  private async fetchAndValidateCartItems(buyerId: string, itemIds: string[]) {
    if (itemIds.length === 0) throw new BadRequestError('Cart is empty');

    const mediaItems = await this.media.findByIds(itemIds);

    if (mediaItems.length !== itemIds.length) {
      throw new BadRequestError('One or more items not found');
    }

    const unpublished = mediaItems.filter((m) => m.status !== MEDIA_STATUS.PUBLISHED);

    if (unpublished.length > 0) {
      throw new BadRequestError(
        `Some items are no longer available: ${unpublished.map((m) => m.id).join(', ')}`,
      );
    }

    const purchasedIds = await this.purchases.findPurchasedItemIds(buyerId, itemIds);

    if (purchasedIds.length > 0) {
      throw new BadRequestError(
        `Some items already purchased: ${purchasedIds.join(', ')}`,
      );
    }

    return mediaItems;
  }

  private async openPaymentSession(
    orderId: string,
    mediaItems: { id: string }[],
    totalAmount: number,
  ): Promise<string> {
    const appUrl = process.env.APP_URL!;
    const totalCents = Math.round(totalAmount * 100);

    try {
      const { checkoutUrl } = await this.payment.createCheckoutSession({
        orderId,
        itemIds: mediaItems.map((m) => m.id),
        totalCents,
        itemCount: mediaItems.length,
        successUrl: `${appUrl}/me/purchases?order=${orderId}`,
      });

      return checkoutUrl;
    } catch {
      await this.orders.markOrderFailed(orderId);
      throw new BadGatewayError('Failed to create checkout session');
    }
  }
}

export const checkoutService = new CheckoutService(
  orderRepository,
  mediaRepository,
  purchaseRepository,
  paymentAdapter,
  cloudinaryService,
);
