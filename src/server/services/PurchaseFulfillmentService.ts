import {
  OrderStatus,
  Prisma,
  Transaction as PrismaTransaction,
  TransactionStatus,
  TransactionType,
} from '@prisma/client';
import { prisma } from 'server/db';
import { findOrderByExternalId, findOrderById } from 'server/repositories/OrderRepository';
import { cloudinaryService } from 'server/services/CloudinaryService';

const PLATFORM_FEE_RATE = new Prisma.Decimal('0.20');
const PHOTOGRAPHER_RATE = new Prisma.Decimal('0.80');

type MediaItemRow = {
  id: string;
  price: Prisma.Decimal;
  photographerId: string;
  cloudinaryPublicId: string;
};

/**
 * Fulfills an order after payment confirmation.
 * Idempotent: exits early if externalOrderId already recorded.
 */
export async function fulfillOrder(orderId: string, externalOrderId: string): Promise<void> {
  const existing = await findOrderByExternalId(externalOrderId);
  if (existing) return;

  const order = await findOrderById(orderId);
  if (!order) return;

  // itemIds come from OrderItem rows — not trusted from the external webhook payload
  const itemIds = order.items.map((item) => item.mediaItemId);
  const mediaItems = await prisma.mediaItem.findMany({
    where: { id: { in: itemIds } },
    select: { id: true, price: true, photographerId: true, cloudinaryPublicId: true },
  });

  const purchases = buildPurchases(mediaItems, order.buyerId);
  const earningsMap = buildEarningsMap(mediaItems);

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.COMPLETED, externalOrderId },
    });

    await tx.purchase.createMany({
      data: purchases.map((p) => ({ ...p, orderId })),
    });

    for (const [photographerId, amount] of earningsMap) {
      await tx.user.update({
        where: { id: photographerId },
        data: { balance: { increment: amount } },
      });

      await tx.transaction.create({
        data: {
          userId: photographerId,
          amount,
          type: TransactionType.SALE,
          externalOrderId,
          status: TransactionStatus.COMPLETED,
        } satisfies Omit<PrismaTransaction, 'id' | 'createdAt'>,
      });
    }
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildPurchases(mediaItems: MediaItemRow[], buyerId: string) {
  return mediaItems.map((item) => ({
    mediaItemId: item.id,
    buyerId,
    amountPaid: item.price,
    platformFee: item.price.mul(PLATFORM_FEE_RATE),
    photographerEarned: item.price.mul(PHOTOGRAPHER_RATE),
    previewUrl: cloudinaryService.tryGeneratePermanentPreviewUrl(item.cloudinaryPublicId),
  }));
}

function buildEarningsMap(mediaItems: MediaItemRow[]): Map<string, Prisma.Decimal> {
  const map = new Map<string, Prisma.Decimal>();
  for (const item of mediaItems) {
    const earned = item.price.mul(PHOTOGRAPHER_RATE);
    map.set(item.photographerId, (map.get(item.photographerId) ?? new Prisma.Decimal(0)).add(earned));
  }
  return map;
}
