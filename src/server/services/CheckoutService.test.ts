import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { createCheckoutSession } from 'server/services/CheckoutService';
import { prismaMock } from 'test/setup/prisma';
import { paymentAdapterMock } from 'test/setup/payment';
import { BadRequestError, BadGatewayError } from 'shared/errors';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.resetAllMocks();
  process.env.APP_URL = 'https://test.wave-atlas.com';
});

// ---------------------------------------------------------------------------
// Factories — minimal valid shapes the mocks need to return
// ---------------------------------------------------------------------------

function makeMediaItem(overrides: Partial<{
  id: string;
  status: string;
  price: Prisma.Decimal;
  photographerId: string;
}> = {}) {
  return {
    id: 'media-1',
    status: 'PUBLISHED',
    price: new Prisma.Decimal('10.00'),
    photographerId: 'photographer-1',
    ...overrides,
  };
}

function makeOrder(mediaItemIds: string[]) {
  return {
    id: 'order-uuid-1',
    buyerId: 'buyer-1',
    totalAmount: new Prisma.Decimal('10.00'),
    status: 'PENDING' as const,
    externalOrderId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    items: mediaItemIds.map((mediaItemId, i) => ({
      id: `item-${i}`,
      orderId: 'order-uuid-1',
      mediaItemId,
    })),
  };
}

// ---------------------------------------------------------------------------
// Helpers — wire up the happy-path mocks in one call
// ---------------------------------------------------------------------------

function setupHappyPath(items = [makeMediaItem()]) {
  // repositories read from prismaMock
  prismaMock.mediaItem.findMany.mockResolvedValue(items as never);
  prismaMock.purchase.findMany.mockResolvedValue([]);  // no prior purchases
  prismaMock.order.create.mockResolvedValue(
    makeOrder(items.map((m) => m.id)) as never
  );

  // payment adapter returns a checkout URL
  paymentAdapterMock.createCheckoutSession.mockResolvedValue({
    checkoutUrl: 'https://pay.cryptocloud.plus/mock-invoice',
  });
}

// ---------------------------------------------------------------------------
// createCheckoutSession
// ---------------------------------------------------------------------------

describe('CheckoutService.createCheckoutSession', () => {
  const BUYER_ID = 'buyer-uuid-1';
  const ITEM_IDS = ['media-1'];

  // ---
  // Happy path
  // ---

  it('returns checkoutUrl and orderId when cart is valid', async () => {
    setupHappyPath();

    const result = await createCheckoutSession(BUYER_ID, ITEM_IDS);

    expect(result.checkoutUrl).toBe(
      'https://pay.cryptocloud.plus/mock-invoice'
    );
    expect(result.orderId).toBe('order-uuid-1');
  });

  it('creates the order before calling the payment adapter', async () => {
    setupHappyPath();

    await createCheckoutSession(BUYER_ID, ITEM_IDS);

    // order.create must be called before createCheckoutSession
    const orderCreateOrder = vi.mocked(prismaMock.order.create).mock
      .invocationCallOrder[0];
    const paymentCallOrder = paymentAdapterMock.createCheckoutSession.mock
      .invocationCallOrder[0];

    expect(orderCreateOrder).toBeLessThan(paymentCallOrder);
  });

  it('passes totalCents derived from DB prices — not from client input', async () => {
    const item1 = makeMediaItem({
      id: 'media-1', price: new Prisma.Decimal('15.50')
    });
    const item2 = makeMediaItem({
      id: 'media-2', price: new Prisma.Decimal('9.50')
    });

    setupHappyPath([item1, item2]);

    await createCheckoutSession(BUYER_ID, ['media-1', 'media-2']);

    // 15.50 + 9.50 = 25.00 → 2500 cents
    expect(paymentAdapterMock.createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({ totalCents: 2500 }),
    );
  });

  // ---
  // Validation failures
  // ---

  it('throws BadRequestError when cart is empty', async () => {
    await expect(createCheckoutSession(BUYER_ID, [])).rejects.toThrow(BadRequestError);
    await expect(createCheckoutSession(BUYER_ID, [])).rejects.toThrow('Cart is empty');
  });

  it('throws BadRequestError when an item id does not exist in DB', async () => {
    // DB returns fewer items than requested — one id is unknown
    prismaMock.mediaItem.findMany.mockResolvedValue([makeMediaItem()] as never);

    await expect(
      createCheckoutSession(BUYER_ID, ['media-1', 'media-UNKNOWN']),
    ).rejects.toThrow('One or more items not found');
  });

  it('throws BadRequestError when a cart item is not published', async () => {
    prismaMock.mediaItem.findMany.mockResolvedValue([
      makeMediaItem({ id: 'media-1', status: 'DRAFT' }),
    ] as never);

    await expect(createCheckoutSession(BUYER_ID, ITEM_IDS)).rejects.toThrow(
      'Some items are no longer available',
    );
  });

  it('throws BadRequestError when buyer already purchased an item', async () => {
    prismaMock.mediaItem.findMany.mockResolvedValue([makeMediaItem()] as never);
    // findPurchasedItemIds returns a non-empty list → already purchased
    prismaMock.purchase.findMany.mockResolvedValue([
      { mediaItemId: 'media-1' },
    ] as never);

    await expect(createCheckoutSession(BUYER_ID, ITEM_IDS)).rejects.toThrow(
      'Some items already purchased',
    );
  });

  // ---
  // Payment adapter failure
  // ---

  it('marks the order as FAILED and throws BadGatewayError when payment adapter rejects', async () => {
    prismaMock.mediaItem.findMany.mockResolvedValue([makeMediaItem()] as never);
    prismaMock.purchase.findMany.mockResolvedValue([]);
    prismaMock.order.create.mockResolvedValue(makeOrder(ITEM_IDS) as never);
    prismaMock.order.update.mockResolvedValue({} as never); // markOrderFailed
    paymentAdapterMock.createCheckoutSession.mockRejectedValue(new Error('CryptoCloud down'));

    await expect(createCheckoutSession(BUYER_ID, ITEM_IDS)).rejects.toThrow(BadGatewayError);
    expect(prismaMock.order.update).toHaveBeenCalledOnce();
  });
});
