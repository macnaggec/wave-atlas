import type { IOrderRepository } from 'server/repositories/OrderRepository';
import type { IMediaRepository } from 'server/repositories/MediaRepository';
import type { IPurchaseRepository, PurchaseWithMedia } from 'server/repositories/PurchaseRepository';
import { orderRepository } from 'server/repositories/OrderRepository';
import { mediaRepository } from 'server/repositories/MediaRepository';
import { purchaseRepository } from 'server/repositories/PurchaseRepository';
import { MediaImportSource } from '@prisma/client';
import { MEDIA_STATUS } from 'entities/Media/constants';
import type { IMediaImportService } from 'server/services/MediaImportService';
import { mediaImportService } from 'server/services/MediaImportService';
import type { PaymentAdapter } from 'server/lib/payment/PaymentAdapter';
import { paymentAdapter } from 'server/lib/payment/activeAdapter';
import type { ICloudinaryService } from 'server/services/CloudinaryService';
import { cloudinaryService } from 'server/services/CloudinaryService';
import { BadRequestError, BadGatewayError, ForbiddenError } from 'shared/errors';
import { logger } from 'shared/lib/logger';

const APP_URL = process.env.APP_URL!;

export class CheckoutService {
  constructor(
    private orders: IOrderRepository,
    private media: IMediaRepository,
    private purchases: IPurchaseRepository,
    private payment: PaymentAdapter,
    private cloudinary: ICloudinaryService,
    private importer: IMediaImportService,
  ) { }

  /**
   * Price validation: prices are always read from DB — never from the client.
   * Items must be PUBLISHED and not already purchased by this buyer.
   */
  async createCheckoutSession(
    buyerId: string | null,
    guestEmail: string | undefined,
    itemIds: string[],
  ): Promise<{ checkoutUrl: string; orderId: string }> {
    const mediaItems = await this.fetchAndValidateCartItems(buyerId, itemIds);
    const totalCents = mediaItems.reduce((sum, item) => sum + item.price, 0);

    const order = await this.orders.createOrder({
      buyerId,
      guestEmail,
      totalAmount: totalCents,
      itemIds
    });

    const checkoutUrl = await this.openPaymentSession(
      order.id,
      buyerId,
      mediaItems,
      totalCents
    );

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

    // strip cloudinaryPublicId before sending to client
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
   * download URL for the original media file.
   *
   * Throws ForbiddenError if no Purchase row exists for (buyerId, mediaItemId).
   */
  async generateDownloadAccess(
    buyerId: string,
    mediaItemId: string,
  ): Promise<{ downloadUrl: string; expiresAt: number }> {
    const purchase = await this.purchases.findByBuyerAndMedia(buyerId, mediaItemId);
    if (!purchase) throw new ForbiddenError('You have not purchased this item');
    return this.resolveDownload(purchase);
  }

  /**
   * Token-based download access for guest purchases.
   * The downloadToken is the proof of purchase — no auth required.
   * Used for email-delivered download links (backlog item 51).
   */
  async generateDownloadAccessByToken(
    downloadToken: string,
  ): Promise<{ downloadUrl: string; expiresAt: number }> {
    const purchase = await this.purchases.findByDownloadToken(downloadToken);
    if (!purchase) throw new ForbiddenError('Invalid or expired download token');
    return this.resolveDownload(purchase);
  }

  /**
   * Download access for guest purchases via purchaseId + orderId.
   * The orderId in the URL is the proof of access — tokens never leave the DB.
   * Security: orderId in WHERE clause acts as ownership check (purchase must belong to that order).
   */
  async getGuestDownloadAccess(
    purchaseId: string,
    orderId: string,
  ): Promise<{ downloadUrl: string; expiresAt: number }> {
    const purchase = await this.purchases.findByIdAndOrder(purchaseId, orderId);
    if (!purchase) throw new ForbiddenError('Purchase not found');
    return this.resolveDownload(purchase);
  }

  async getGuestPurchases(orderId: string) {
    return this.purchases.findByOrder(orderId);
  }

  async saveGuestEmail(orderId: string, email: string): Promise<void> {
    await this.orders.saveGuestEmail(orderId, email);
  }

  private async fetchAndValidateCartItems(buyerId: string | null, itemIds: string[]) {
    if (itemIds.length === 0) throw new BadRequestError('Cart is empty');

    const mediaItems = await this.media.findByIds(itemIds);

    if (mediaItems.length !== itemIds.length) {
      throw new BadRequestError('One or more items not found');
    }

    this.assertItemsPublished(mediaItems);
    await this.assertDriveItemsAvailable(mediaItems);
    await this.assertBuyerEligible(buyerId, mediaItems, itemIds);

    return mediaItems;
  }

  private assertItemsPublished(
    mediaItems: { id: string; status: string }[],
  ): void {
    const unpublished = mediaItems.filter((m) => m.status !== MEDIA_STATUS.PUBLISHED);
    if (unpublished.length > 0) {
      throw new BadRequestError(
        `Some items are no longer available: ${unpublished.map((m) => m.id).join(', ')}`,
      );
    }
  }

  private async assertDriveItemsAvailable(
    mediaItems: { id: string; importSource: string; remoteFileId: string | null }[],
  ): Promise<void> {
    // Any non-DIRECT source is remote — new providers are covered automatically.
    const remoteItems = mediaItems.filter(
      (m) => m.importSource !== MediaImportSource.DIRECT
    );

    if (remoteItems.length === 0) return;

    const checks = await Promise.all(
      remoteItems.map((m) =>
        this.importer
          .verifyRemoteAvailability(
            m.importSource as MediaImportSource, m.remoteFileId!
          )
          .then((ok) => ({ id: m.id, ok }))
      ),
    );

    const unavailable = checks.filter((c) => !c.ok);

    if (unavailable.length > 0) {
      throw new BadRequestError(
        `Some items are no longer available: ${unavailable.map((c) => c.id).join(', ')}`,
      );
    }
  }

  private async assertBuyerEligible(
    buyerId: string | null,
    mediaItems: { id: string; photographerId: string }[],
    itemIds: string[],
  ): Promise<void> {
    if (buyerId === null) return;

    const ownedItems = mediaItems.filter((m) => m.photographerId === buyerId);
    if (ownedItems.length > 0) {
      throw new BadRequestError('You cannot purchase your own media');
    }

    const purchasedIds = await this.purchases.findPurchasedItemIds(buyerId, itemIds);
    if (purchasedIds.length > 0) {
      throw new BadRequestError(
        `Some items already purchased: ${purchasedIds.join(', ')}`,
      );
    }
  }

  /** Routes download to the correct provider based on the purchase's import source. */
  private resolveDownload(
    purchase: PurchaseWithMedia,
  ): Promise<{ downloadUrl: string; expiresAt: number }> {
    // DIRECT items are always in Cloudinary. All remote sources go through the importer.
    if (purchase.mediaItem.importSource === MediaImportSource.DIRECT) {
      return Promise.resolve(
        this.cloudinary.generateSignedDownload(purchase.mediaItem.cloudinaryPublicId),
      );
    }
    return this.importer.importForDownload(
      purchase.mediaItem.importSource as MediaImportSource,
      purchase.mediaItem.remoteFileId!,
    );
  }

  private async openPaymentSession(
    orderId: string,
    buyerId: string | null,
    mediaItems: { id: string }[],
    totalCents: number,
  ): Promise<string> {
    const successUrl = buyerId
      ? `${APP_URL}/me/purchases?order=${orderId}`
      : `${APP_URL}/order-success?orderId=${orderId}`;

    try {
      const { checkoutUrl } = await this.payment.createCheckoutSession({
        orderId,
        totalCents,
        successUrl,
        failUrl: `${APP_URL}/cart`,
      });

      return checkoutUrl;
    } catch (err) {
      logger.error('[CheckoutService] Payment gateway error', {
        err, orderId
      });

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
  mediaImportService,
);
