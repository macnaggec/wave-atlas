import {
  Order as PrismaOrder,
  OrderItem as PrismaOrderItem,
  Purchase as PrismaPurchase,
  Transaction as PrismaTransaction,
  OrderStatus,
  TransactionStatus,
  TransactionType,
  Prisma,
} from '@prisma/client';
import { prisma } from 'server/db';

export type OrderWithItems = PrismaOrder & { items: PrismaOrderItem[] };

export type PurchaseWithMedia = PrismaPurchase & {
  mediaItem: {
    id: string;
    cloudinaryPublicId: string;
    thumbnailUrl: string;
  };
};


export async function createOrder(data: {
  buyerId: string;
  totalAmount: Prisma.Decimal;
  itemIds: string[];
}): Promise<OrderWithItems> {
  return prisma.order.create({
    data: {
      buyerId: data.buyerId,
      totalAmount: data.totalAmount,
      items: {
        createMany: {
          data: data.itemIds.map((mediaItemId) => ({ mediaItemId })),
        },
      },
    },
    include: { items: true },
  });
}

export async function findOrderById(
  id: string
): Promise<OrderWithItems | null> {
  return prisma.order.findUnique({
    where: { id },
    include: { items: true }
  });
}

export async function findOrderByExternalId(
  externalOrderId: string
): Promise<PrismaOrder | null> {
  return prisma.order.findUnique({ where: { externalOrderId } });
}

export async function findPurchasesByBuyer(
  buyerId: string
): Promise<PurchaseWithMedia[]> {
  return prisma.purchase.findMany({
    where: { buyerId },
    take: 50,
    include: {
      mediaItem: {
        select: {
          id: true,
          cloudinaryPublicId: true,
          thumbnailUrl: true,
        },
      },
    },
    orderBy: { purchasedAt: 'desc' },
  });
}

export async function findPurchaseByBuyerAndMedia(
  buyerId: string,
  mediaItemId: string,
): Promise<PurchaseWithMedia | null> {
  return prisma.purchase.findFirst({
    where: { buyerId, mediaItemId },
    include: {
      mediaItem: {
        select: {
          id: true,
          cloudinaryPublicId: true,
          thumbnailUrl: true,
        },
      },
    },
  });
}

export async function findPurchasedItemIds(
  buyerId: string,
  itemIds: string[],
): Promise<string[]> {
  const rows = await prisma.purchase.findMany({
    where: { buyerId, mediaItemId: { in: itemIds } },
    select: { mediaItemId: true },
  });
  return rows.map((r) => r.mediaItemId);
}

export async function markOrderFailed(
  orderId: string
): Promise<PrismaOrder> {
  return prisma.order.update({
    where: { id: orderId },
    data: { status: OrderStatus.FAILED },
  });
}

export type FulfillPurchaseData = {
  mediaItemId: string;
  buyerId: string;
  amountPaid: number;
  platformFee: number;
  photographerEarned: number;
  previewUrl: string | null;
};

export async function fulfill(
  orderId: string,
  externalOrderId: string,
  purchases: FulfillPurchaseData[],
  earningsMap: Map<string, number>,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.COMPLETED, externalOrderId },
    });

    await tx.purchase.createMany({
      data: purchases.map((p) => ({ ...p, orderId })),
    });

    for (const [photographerId, amount] of earningsMap) {
      const decimalAmount = new Prisma.Decimal(amount);

      await tx.user.update({
        where: { id: photographerId },
        data: { balance: { increment: decimalAmount } },
      });

      await tx.transaction.create({
        data: {
          userId: photographerId,
          amount: decimalAmount,
          type: TransactionType.SALE,
          externalOrderId,
          status: TransactionStatus.COMPLETED,
        } satisfies Omit<PrismaTransaction, 'id' | 'createdAt'>,
      });
    }
  });
}
