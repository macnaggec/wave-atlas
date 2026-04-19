import {
  Order as PrismaOrder,
  OrderItem as PrismaOrderItem,
  Purchase as PrismaPurchase,
  OrderStatus,
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
