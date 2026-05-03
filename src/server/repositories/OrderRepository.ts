import { OrderStatus } from '@prisma/client';
import { prisma } from 'server/db';
import { runQuery } from './BaseRepository';

export type OrderWithItems = {
  id: string;
  buyerId: string;
  externalOrderId: string | null;
  totalAmount: number;
  status: string;
  items: { id: string; mediaItemId: string }[];
};

export type CreateOrderData = {
  buyerId: string;
  totalAmount: number;
  itemIds: string[];
};

export interface IOrderRepository {
  createOrder(data: CreateOrderData): Promise<OrderWithItems>;
  findOrderById(id: string): Promise<OrderWithItems | null>;
  findOrderByExternalId(externalOrderId: string): Promise<{ id: string } | null>;
  markOrderFailed(orderId: string): Promise<void>;
}

export class OrderRepository implements IOrderRepository {
  createOrder(data: CreateOrderData): Promise<OrderWithItems> {
    return runQuery(async () => {
      const row = await prisma.order.create({
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
      return mapOrder(row);
    });
  }

  findOrderById(id: string): Promise<OrderWithItems | null> {
    return runQuery(async () => {
      const row = await prisma.order.findUnique({ where: { id }, include: { items: true } });
      return row ? mapOrder(row) : null;
    });
  }

  findOrderByExternalId(externalOrderId: string): Promise<{ id: string } | null> {
    return runQuery(() =>
      prisma.order.findUnique({ where: { externalOrderId }, select: { id: true } })
    );
  }

  markOrderFailed(orderId: string): Promise<void> {
    return runQuery(async () => {
      await prisma.order.update({ where: { id: orderId }, data: { status: OrderStatus.FAILED } });
    });
  }
}

export const orderRepository = new OrderRepository();

type PrismaOrderWithItems = {
  id: string;
  buyerId: string;
  externalOrderId: string | null;
  totalAmount: { toNumber(): number };
  status: string;
  items: { id: string; mediaItemId: string }[];
};

function mapOrder(row: PrismaOrderWithItems): OrderWithItems {
  return {
    id: row.id,
    buyerId: row.buyerId,
    externalOrderId: row.externalOrderId,
    totalAmount: row.totalAmount.toNumber(),
    status: row.status,
    items: row.items.map(({ id, mediaItemId }) => ({ id, mediaItemId })),
  };
}

