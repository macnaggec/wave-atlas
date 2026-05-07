import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PurchaseFulfillmentService } from 'server/services/PurchaseFulfillmentService';
import type { OrderWithItems } from 'server/repositories/OrderRepository';
import type { MediaFulfillmentItem } from 'server/repositories/MediaRepository';
import type { FulfillPurchaseData, FulfillmentPayload } from 'server/repositories/PurchaseRepository';

// ---------------------------------------------------------------------------
// Inline mocks — no vi.mock() needed with constructor injection
// ---------------------------------------------------------------------------

const mockPurchases = {
  commitFulfillment: vi.fn().mockResolvedValue(undefined),
  findByBuyer: vi.fn(),
  findByBuyerAndMedia: vi.fn(),
  findPurchasedItemIds: vi.fn(),
};

const mockOrders = {
  findOrderByExternalId: vi.fn(),
  findOrderById: vi.fn(),
  createOrder: vi.fn(),
  markOrderFailed: vi.fn(),
};

const mockMedia = {
  findByIdsForFulfillment: vi.fn(),
};

const mockCloudinary = {
  tryGeneratePermanentPreviewUrl: vi.fn().mockReturnValue('https://res.cloudinary.com/preview'),
};

const service = new PurchaseFulfillmentService(
  mockOrders as any,
  mockMedia as any,
  mockPurchases as any,
  mockCloudinary,
);

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockPurchases.commitFulfillment.mockResolvedValue(undefined);
  mockCloudinary.tryGeneratePermanentPreviewUrl.mockReturnValue('https://res.cloudinary.com/preview');
});

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function makeOrder(overrides: Partial<OrderWithItems> = {}): OrderWithItems {
  return {
    id: 'order-1',
    buyerId: 'buyer-1',
    externalOrderId: null,
    totalAmount: 10,
    status: 'PENDING',
    items: [{ id: 'oi-1', mediaItemId: 'media-1' }],
    ...overrides,
  };
}

function makeMediaItem(overrides: Partial<MediaFulfillmentItem> = {}): MediaFulfillmentItem {
  return {
    id: 'media-1',
    price: 1000,
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

  function setupHappyPath(mediaItems: MediaFulfillmentItem[] = [makeMediaItem()]) {
    mockOrders.findOrderByExternalId.mockResolvedValue(null);
    mockOrders.findOrderById.mockResolvedValue(makeOrder());
    mockMedia.findByIdsForFulfillment.mockResolvedValue(mediaItems);
  }

  // -------------------------------------------------------------------------
  // Idempotency
  // -------------------------------------------------------------------------

  it('exits early without writing if externalOrderId already recorded', async () => {
    mockOrders.findOrderByExternalId.mockResolvedValue(makeOrder({ externalOrderId: EXTERNAL_ID }));

    await service.fulfillOrder(ORDER_ID, EXTERNAL_ID);

    expect(mockPurchases.commitFulfillment).not.toHaveBeenCalled();
  });

  it('exits early without writing if the order does not exist', async () => {
    mockOrders.findOrderByExternalId.mockResolvedValue(null);
    mockOrders.findOrderById.mockResolvedValue(null);

    await service.fulfillOrder(ORDER_ID, EXTERNAL_ID);

    expect(mockPurchases.commitFulfillment).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Purchase data written inside transaction
  // -------------------------------------------------------------------------

  it('writes one purchase entry per media item with correct fields', async () => {
    setupHappyPath([makeMediaItem({ price: 1000 })]);

    await service.fulfillOrder(ORDER_ID, EXTERNAL_ID);

    const payload = mockPurchases.commitFulfillment.mock.calls[0]![0] as FulfillmentPayload;
    expect(payload.purchases).toHaveLength(1);
    expect(payload.purchases[0]).toMatchObject<Partial<FulfillPurchaseData>>({
      mediaItemId: 'media-1',
      buyerId: 'buyer-1',
      amountPaid: 1000,
      platformFee: 200,
      photographerEarned: 800,
      previewUrl: 'https://res.cloudinary.com/preview',
    });
  });

  // -------------------------------------------------------------------------
  // Earnings credited inside transaction
  // -------------------------------------------------------------------------

  it('credits aggregated earnings when two items share the same photographer', async () => {
    // (1000 + 2000) * 0.80 = 2400
    const items = [
      makeMediaItem({ id: 'media-1', price: 1000, photographerId: 'p-1' }),
      makeMediaItem({ id: 'media-2', price: 2000, photographerId: 'p-1' }),
    ];
    mockOrders.findOrderByExternalId.mockResolvedValue(null);
    mockOrders.findOrderById.mockResolvedValue(makeOrder({
      items: [
        { id: 'oi-1', mediaItemId: 'media-1' },
        { id: 'oi-2', mediaItemId: 'media-2' },
      ],
    }));
    mockMedia.findByIdsForFulfillment.mockResolvedValue(items);

    await service.fulfillOrder(ORDER_ID, EXTERNAL_ID);

    const payload = mockPurchases.commitFulfillment.mock.calls[0]![0] as FulfillmentPayload;
    expect(payload.earnings).toHaveLength(1);
    expect(payload.earnings[0]).toMatchObject({ photographerId: 'p-1', amount: 2400 });
  });

  it('credits separate earnings when photographers differ', async () => {
    const items = [
      makeMediaItem({ id: 'media-1', price: 1000, photographerId: 'p-1' }),
      makeMediaItem({ id: 'media-2', price: 2000, photographerId: 'p-2' }),
    ];
    mockOrders.findOrderByExternalId.mockResolvedValue(null);
    mockOrders.findOrderById.mockResolvedValue(makeOrder({
      items: [
        { id: 'oi-1', mediaItemId: 'media-1' },
        { id: 'oi-2', mediaItemId: 'media-2' },
      ],
    }));
    mockMedia.findByIdsForFulfillment.mockResolvedValue(items);

    await service.fulfillOrder(ORDER_ID, EXTERNAL_ID);

    const payload = mockPurchases.commitFulfillment.mock.calls[0]![0] as FulfillmentPayload;
    const ids = payload.earnings.map((e) => e.photographerId).sort();
    expect(ids).toEqual(['p-1', 'p-2']);
  });

  // -------------------------------------------------------------------------
  // Security: itemIds sourced from DB, not the webhook payload
  // -------------------------------------------------------------------------

  it('resolves media from DB order items — not from the webhook payload', async () => {
    setupHappyPath();

    await service.fulfillOrder(ORDER_ID, EXTERNAL_ID);

    expect(mockMedia.findByIdsForFulfillment).toHaveBeenCalledWith(['media-1']);
  });

  // -------------------------------------------------------------------------
  // Race-condition idempotency: ConflictError from commitFulfillment
  // Guards the catch block that makes the DB unique-constraint race safe.
  // -------------------------------------------------------------------------

  it('swallows ConflictError from commitFulfillment — treats it as idempotent success', async () => {
    const { ConflictError } = await import('shared/errors');
    setupHappyPath();
    mockPurchases.commitFulfillment.mockRejectedValue(
      new ConflictError('external_order_id already exists'),
    );

    await expect(service.fulfillOrder(ORDER_ID, EXTERNAL_ID)).resolves.toBeUndefined();
  });

  it('rethrows non-ConflictError from commitFulfillment — does not swallow real failures', async () => {
    setupHappyPath();
    const boom = new Error('DB connection lost');
    mockPurchases.commitFulfillment.mockRejectedValue(boom);

    await expect(service.fulfillOrder(ORDER_ID, EXTERNAL_ID)).rejects.toThrow('DB connection lost');
  });
});


