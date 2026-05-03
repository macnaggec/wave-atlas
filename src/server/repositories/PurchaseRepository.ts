import {
  OrderStatus,
  TransactionStatus,
  TransactionType,
  Prisma,
} from '@prisma/client';
import { prisma } from 'server/db';
import { runQuery } from './BaseRepository';

export type PurchaseWithMedia = {
  id: string;
  purchasedAt: Date;
  amountPaid: number;
  previewUrl: string | null;
  mediaItem: {
    id: string;
    cloudinaryPublicId: string;
    thumbnailUrl: string;
  };
};

export type FulfillPurchaseData = {
  mediaItemId: string;
  buyerId: string;
  amountPaid: number;
  platformFee: number;
  photographerEarned: number;
  previewUrl: string | null;
};

export type EarningsEntry = {
  photographerId: string;
  amount: number;
};

export type FulfillmentPayload = {
  orderId: string;
  externalOrderId: string;
  purchases: (FulfillPurchaseData & { orderId: string })[];
  earnings: EarningsEntry[];
};

export interface IPurchaseRepository {
  findByBuyer(buyerId: string): Promise<PurchaseWithMedia[]>;
  findByBuyerAndMedia(buyerId: string, mediaItemId: string): Promise<PurchaseWithMedia | null>;
  findPurchasedItemIds(buyerId: string, itemIds: string[]): Promise<string[]>;
  commitFulfillment(payload: FulfillmentPayload): Promise<void>;
}

export class PurchaseRepository implements IPurchaseRepository {
  findByBuyer(buyerId: string): Promise<PurchaseWithMedia[]> {
    return runQuery(async () => {
      const rows = await prisma.purchase.findMany({
        where: { buyerId },
        take: 50,
        select: {
          id: true,
          purchasedAt: true,
          amountPaid: true,
          previewUrl: true,
          mediaItem: {
            select: { id: true, cloudinaryPublicId: true, thumbnailUrl: true },
          },
        },
        orderBy: { purchasedAt: 'desc' },
      });
      return rows.map((row) => ({ ...row, amountPaid: row.amountPaid.toNumber() }));
    });
  }

  findByBuyerAndMedia(buyerId: string, mediaItemId: string): Promise<PurchaseWithMedia | null> {
    return runQuery(async () => {
      const row = await prisma.purchase.findFirst({
        where: { buyerId, mediaItemId },
        select: {
          id: true,
          purchasedAt: true,
          amountPaid: true,
          previewUrl: true,
          mediaItem: {
            select: { id: true, cloudinaryPublicId: true, thumbnailUrl: true },
          },
        },
      });
      return row ? { ...row, amountPaid: row.amountPaid.toNumber() } : null;
    });
  }

  findPurchasedItemIds(buyerId: string, itemIds: string[]): Promise<string[]> {
    return runQuery(async () => {
      const rows = await prisma.purchase.findMany({
        where: { buyerId, mediaItemId: { in: itemIds } },
        select: { mediaItemId: true },
      });
      return rows.map((r) => r.mediaItemId);
    });
  }

  commitFulfillment(payload: FulfillmentPayload): Promise<void> {
    return runQuery(() =>
      prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: payload.orderId },
          data: { status: OrderStatus.COMPLETED, externalOrderId: payload.externalOrderId },
        });

        await tx.purchase.createMany({ data: payload.purchases });

        for (const { photographerId, amount } of payload.earnings) {
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
              externalOrderId: payload.externalOrderId,
              status: TransactionStatus.COMPLETED,
            },
          });
        }
      })
    );
  }
}

export const purchaseRepository = new PurchaseRepository();
