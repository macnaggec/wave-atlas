import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { fulfillOrder } from 'server/services/PurchaseFulfillmentService';
import { prismaMock } from 'test/setup/prisma';

// ---------------------------------------------------------------------------
// CloudinaryService is NOT globally mocked — mock it here for this suite.
// tryGeneratePermanentPreviewUrl produces the preview URL stored on Purchase.
// We don't care about the URL value in fulfillment tests, just that it's called.
// ---------------------------------------------------------------------------
vi.mock('server/services/CloudinaryService', () => ({
  cloudinaryService: {
    tryGeneratePermanentPreviewUrl: vi.fn().mockReturnValue(
      'https://res.cloudinary.com/preview'
    ),
    generateSignedDownload: vi.fn(),
    generatePermanentPreviewUrl: vi.fn(),
    generateUploadSignature: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  // clearAllMocks resets call history but preserves mock implementations
  // set in vi.mock() above — unlike resetAllMocks which would wipe them.
  vi.clearAllMocks();

  // $transaction must actually invoke its callback — otherwise all tx.*
  // calls inside fulfillOrder run against the mock but nothing is recorded.
  // We pass prismaMock itself as the tx argument (same deep mock, same refs).
  prismaMock.$transaction.mockImplementation(
    (fn: (tx: any) => Promise<unknown>) => fn(prismaMock)
  );
});

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function makeOrder(overrides: Partial<{
  id: string;
  buyerId: string;
  externalOrderId: string | null;
  items: { id: string; orderId: string; mediaItemId: string }[];
}> = {}) {
  return {
    id: 'order-1',
    buyerId: 'buyer-1',
    externalOrderId: null,
    totalAmount: new Prisma.Decimal('10.00'),
    status: 'PENDING' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    items: [{ id: 'oi-1', orderId: 'order-1', mediaItemId: 'media-1' }],
    ...overrides,
  };
}

function makeMediaItem(overrides: Partial<{
  id: string;
  price: Prisma.Decimal;
  photographerId: string;
  cloudinaryPublicId: string;
}> = {}) {
  return {
    id: 'media-1',
    price: new Prisma.Decimal('10.00'),
    photographerId: 'photographer-1',
    cloudinaryPublicId: 'waves/photo-001',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// fulfillOrder
// ---------------------------------------------------------------------------

describe('PurchaseFulfillmentService.fulfillOrder', () => {
  const ORDER_ID = 'order-1';
  const EXTERNAL_ID = 'CC-ILRAJE1Q';

  // -------------------------------------------------------------------------
  // Idempotency
  // -------------------------------------------------------------------------

  it('exits early without running the transaction if externalOrderId already recorded', async () => {
    // findOrderByExternalId → returns an existing order (duplicate webhook)
    prismaMock.order.findUnique.mockResolvedValueOnce(
      makeOrder({ externalOrderId: EXTERNAL_ID }) as never
    );

    await fulfillOrder(ORDER_ID, EXTERNAL_ID);

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('exits early without running the transaction if the order does not exist', async () => {
    prismaMock.order.findUnique.mockResolvedValueOnce(null); // findOrderByExternalId → not a duplicate
    prismaMock.order.findUnique.mockResolvedValueOnce(null); // findOrderById → order not found

    await fulfillOrder(ORDER_ID, EXTERNAL_ID);

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Happy path
  // -------------------------------------------------------------------------

  function setupHappyPath(mediaItems = [makeMediaItem()]) {
    prismaMock.order.findUnique
      .mockResolvedValueOnce(null)                          // findOrderByExternalId → not a duplicate
      .mockResolvedValueOnce(makeOrder() as never);         // findOrderById → order found

    prismaMock.mediaItem.findMany.mockResolvedValue(mediaItems as never);
    prismaMock.order.update.mockResolvedValue({} as never);
    prismaMock.purchase.createMany.mockResolvedValue({ count: mediaItems.length });
    prismaMock.user.update.mockResolvedValue({} as never);
    prismaMock.transaction.create.mockResolvedValue({} as never);
  }

  it('marks the order as COMPLETED with the externalOrderId', async () => {
    setupHappyPath();

    await fulfillOrder(ORDER_ID, EXTERNAL_ID);

    expect(prismaMock.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: ORDER_ID },
        data: expect.objectContaining({
          status: 'COMPLETED',
          externalOrderId: EXTERNAL_ID,
        }),
      }),
    );
  });

  it('creates one Purchase row per media item', async () => {
    setupHappyPath();

    await fulfillOrder(ORDER_ID, EXTERNAL_ID);

    expect(prismaMock.purchase.createMany).toHaveBeenCalledOnce();
    const data = (prismaMock.purchase.createMany.mock.calls[0]?.[0]?.data ?? []) as Array<{ mediaItemId: string; buyerId: string }>;
    expect(data).toHaveLength(1);
    expect(data[0]?.mediaItemId).toBe('media-1');
    expect(data[0]?.buyerId).toBe('buyer-1');
  });

  it('increments photographer balance by 80% of the item price', async () => {
    // item price = $10.00 → photographer gets $8.00
    setupHappyPath([makeMediaItem({ price: new Prisma.Decimal('10.00') })]);

    await fulfillOrder(ORDER_ID, EXTERNAL_ID);

    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'photographer-1' },
        data: { balance: { increment: new Prisma.Decimal('8.00') } },
      }),
    );
  });

  it('aggregates earnings correctly when two items share the same photographer', async () => {
    // Two items, same photographer: $10.00 + $20.00 = $30.00 → 80% = $24.00
    const items = [
      makeMediaItem({ id: 'media-1', price: new Prisma.Decimal('10.00'), photographerId: 'p-1' }),
      makeMediaItem({ id: 'media-2', price: new Prisma.Decimal('20.00'), photographerId: 'p-1' }),
    ];
    const order = makeOrder({
      items: [
        { id: 'oi-1', orderId: ORDER_ID, mediaItemId: 'media-1' },
        { id: 'oi-2', orderId: ORDER_ID, mediaItemId: 'media-2' },
      ],
    });
    prismaMock.order.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(order as never);
    prismaMock.mediaItem.findMany.mockResolvedValue(items as never);
    prismaMock.order.update.mockResolvedValue({} as never);
    prismaMock.purchase.createMany.mockResolvedValue({ count: 2 });
    prismaMock.user.update.mockResolvedValue({} as never);
    prismaMock.transaction.create.mockResolvedValue({} as never);

    await fulfillOrder(ORDER_ID, EXTERNAL_ID);

    // Only one user.update call — earnings are aggregated before the loop
    expect(prismaMock.user.update).toHaveBeenCalledOnce();
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'p-1' },
        data: { balance: { increment: new Prisma.Decimal('24.00') } },
      }),
    );
  });

  it('creates one Purchase row per item and splits earnings when photographers differ', async () => {
    const items = [
      makeMediaItem({ id: 'media-1', price: new Prisma.Decimal('10.00'), photographerId: 'p-1' }),
      makeMediaItem({ id: 'media-2', price: new Prisma.Decimal('20.00'), photographerId: 'p-2' }),
    ];
    const order = makeOrder({
      items: [
        { id: 'oi-1', orderId: ORDER_ID, mediaItemId: 'media-1' },
        { id: 'oi-2', orderId: ORDER_ID, mediaItemId: 'media-2' },
      ],
    });
    prismaMock.order.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(order as never);
    prismaMock.mediaItem.findMany.mockResolvedValue(items as never);
    prismaMock.order.update.mockResolvedValue({} as never);
    prismaMock.purchase.createMany.mockResolvedValue({ count: 2 });
    prismaMock.user.update.mockResolvedValue({} as never);
    prismaMock.transaction.create.mockResolvedValue({} as never);

    await fulfillOrder(ORDER_ID, EXTERNAL_ID);

    // Two purchases — one per item
    const data = (prismaMock.purchase.createMany.mock.calls[0]?.[0]?.data ?? []) as Array<{ mediaItemId: string }>;
    expect(data).toHaveLength(2);

    // Two separate balance increments — one per photographer
    expect(prismaMock.user.update).toHaveBeenCalledTimes(2);
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'p-1' },
        data: { balance: { increment: new Prisma.Decimal('8.00') } },
      }),
    );
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'p-2' },
        data: { balance: { increment: new Prisma.Decimal('16.00') } },
      }),
    );

    // Two transaction records — one per photographer
    expect(prismaMock.transaction.create).toHaveBeenCalledTimes(2);
  });

  it('creates one Transaction record per photographer', async () => {
    setupHappyPath();

    await fulfillOrder(ORDER_ID, EXTERNAL_ID);

    expect(prismaMock.transaction.create).toHaveBeenCalledOnce();
    expect(prismaMock.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'photographer-1',
          externalOrderId: EXTERNAL_ID,
          type: 'SALE',
          status: 'COMPLETED',
        }),
      }),
    );
  });

  it('reads itemIds from the order DB row — not from the external webhook', async () => {
    // The order in DB contains media-1. If fulfillment used itemIds from
    // the webhook payload it could be tricked into fulfilling wrong items.
    setupHappyPath();

    await fulfillOrder(ORDER_ID, EXTERNAL_ID);

    const findManyCall = prismaMock.mediaItem.findMany.mock.calls[0]?.[0] as { where: { id: { in: string[] } } } | undefined;
    expect(findManyCall?.where.id.in).toEqual(['media-1']);
  });
});
