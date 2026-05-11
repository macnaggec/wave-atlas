import { randomBytes } from 'crypto';
import type { IOrderRepository } from 'server/repositories/OrderRepository';
import type { IMediaRepository } from 'server/repositories/MediaRepository';
import type { IFulfillmentRepository } from 'server/repositories/FulfillmentRepository';
import { orderRepository } from 'server/repositories/OrderRepository';
import { mediaRepository } from 'server/repositories/MediaRepository';
import { fulfillmentRepository } from 'server/repositories/FulfillmentRepository';
import type { ICloudinaryService } from 'server/services/CloudinaryService';
import { cloudinaryService } from 'server/services/CloudinaryService';
import { ConflictError } from 'shared/errors';

const PLATFORM_FEE_RATE = 0.20;
const PHOTOGRAPHER_RATE = 0.80;

export class PurchaseFulfillmentService {
  constructor(
    private orders: IOrderRepository,
    private media: IMediaRepository,
    private fulfillment: IFulfillmentRepository,
    private cloudinary: Pick<ICloudinaryService, 'tryGeneratePermanentPreviewUrl'>,
  ) { }

  /**
   * Fulfills an order after payment confirmation.
   * Idempotent: exits early if externalOrderId already recorded.
   * P2002 (@@unique externalOrderId race) is caught via BaseRepository.run → mapPrismaError → ConflictError,
   * which callers treat as idempotent success.
   */
  async fulfillOrder(orderId: string, externalOrderId: string): Promise<void> {
    const existing = await this.orders.findOrderByExternalId(externalOrderId);
    if (existing) return;

    const order = await this.orders.findOrderById(orderId);
    if (!order) return;

    // itemIds come from OrderItem rows — not trusted from the external webhook payload
    const itemIds = order.items.map((item) => item.mediaItemId);
    const mediaItems = await this.media.findByIdsForFulfillment(itemIds);

    const purchaseData = [];
    const earningsMap = new Map<string, number>();

    for (const item of mediaItems) {
      purchaseData.push({
        mediaItemId: item.id,
        buyerId: order.buyerId,
        guestEmail: order.guestEmail,
        downloadToken: randomBytes(32).toString('hex'),
        amountPaid: item.price,
        platformFee: item.price * PLATFORM_FEE_RATE,
        photographerEarned: item.price * PHOTOGRAPHER_RATE,
        previewUrl: this.cloudinary.tryGeneratePermanentPreviewUrl(item.cloudinaryPublicId),
      });
      earningsMap.set(
        item.photographerId,
        (earningsMap.get(item.photographerId) ?? 0) + item.price * PHOTOGRAPHER_RATE,
      );
    }

    try {
      await this.fulfillment.commitFulfillment({
        orderId,
        externalOrderId,
        purchases: purchaseData.map((p) => ({ ...p, orderId })),
        earnings: Array.from(earningsMap, ([photographerId, amount]) => ({ photographerId, amount })),
      });
    } catch (err) {
      // P2002 on externalOrderId unique constraint — concurrent webhook delivered the same event
      if (err instanceof ConflictError) return;
      throw err;
    }
  }
}

export const purchaseFulfillmentService = new PurchaseFulfillmentService(
  orderRepository,
  mediaRepository,
  fulfillmentRepository,
  cloudinaryService,
);

