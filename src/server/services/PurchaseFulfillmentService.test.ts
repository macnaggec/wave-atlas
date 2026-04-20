import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fulfillOrder } from 'server/services/PurchaseFulfillmentService';
import * as OrderRepository from 'server/repositories/OrderRepository';
import type { FulfillPurchaseData, OrderWithItems } from 'server/repositories/OrderRepository';
import * as MediaRepository from 'server/repositories/MediaRepository';
import type { MediaFulfillmentItem } from 'server/repositories/MediaRepository';

// ---------------------------------------------------------------------------
// Mock at the repository boundary — the service's actual direct dependencies.
// Tests verify what the service computes and passes to fulfill(), not what
// Prisma receives internally (that belongs in OrderRepository tests).
// ---------------------------------------------------------------------------

vi.mock('server/repositories/OrderRepository', () => ({
  findOrderByExternalId: vi.fn(),
  findOrderById: vi.fn(),
  fulfill: vi.fn(),
}));

vi.mock('server/repositories/MediaRepository', () => ({
  findMediaByIdsForFulfillment: vi.fn(),
}));

vi.mock('server/services/CloudinaryService', () => ({
  cloudinaryService: {
    tryGeneratePermanentPreviewUrl: vi.fn().mockReturnValue('https://res.cloudinary.com/preview'),
  },
}));

const { findOrderByExternalId, findOrderById, fulfill } = vi.mocked(OrderRepository);
const { findMediaByIdsForFulfillment } = vi.mocked(MediaRepository);

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  fulfill.mockResolvedValue(undefined);
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
    items: [{ id: 'oi-1', orderId: 'order-1', mediaItemId: 'media-1' }],
    ...overrides,
  } as unknown as OrderWithItems;
}

// price is number — matches MediaFulfillmentItem after the repository translation boundary
function makeMediaItem(overrides: Partial<MediaFulfillmentItem> = {}): MediaFulfillmentItem {
  return {
    id: 'media-1',
    price: 10,
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
    findOrderByExternalId.mockResolvedValue(null);
    findOrderById.mockResolvedValue(makeOrder());
    findMediaByIdsForFulfillment.mockResolvedValue(mediaItems);
  }

  // -------------------------------------------------------------------------
  // Idempotency
  // -------------------------------------------------------------------------

  it('exits early without calling fulfill if externalOrderId already recorded', async () => {
    findOrderByExternalId.mockResolvedValue(makeOrder({ externalOrderId: EXTERNAL_ID }));

    await fulfillOrder(ORDER_ID, EXTERNAL_ID);

    expect(fulfill).not.toHaveBeenCalled();
  });

  it('exits early without calling fulfill if the order does not exist', async () => {
    findOrderByExternalId.mockResolvedValue(null);
    findOrderById.mockResolvedValue(null);

    await fulfillOrder(ORDER_ID, EXTERNAL_ID);

    expect(fulfill).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Purchase data passed to fulfill()
  // -------------------------------------------------------------------------

  it('passes one purchase entry per media item with correct fields', async () => {
    setupHappyPath([makeMediaItem({ price: 10 })]);

    await fulfillOrder(ORDER_ID, EXTERNAL_ID);

    const [, , purchases] = fulfill.mock.calls[0]!;
    expect(purchases).toHaveLength(1);
    expect(purchases[0]).toMatchObject<Partial<FulfillPurchaseData>>({
      mediaItemId: 'media-1',
      buyerId: 'buyer-1',
      amountPaid: 10,
      platformFee: 2,
      photographerEarned: 8,
      previewUrl: 'https://res.cloudinary.com/preview',
    });
  });

  // -------------------------------------------------------------------------
  // Earnings map passed to fulfill()
  // -------------------------------------------------------------------------

  it('aggregates earnings when two items share the same photographer', async () => {
    // (10 + 20) * 0.80 = 24
    const items = [
      makeMediaItem({ id: 'media-1', price: 10, photographerId: 'p-1' }),
      makeMediaItem({ id: 'media-2', price: 20, photographerId: 'p-1' }),
    ];
    findOrderByExternalId.mockResolvedValue(null);
    findOrderById.mockResolvedValue(makeOrder({
      items: [
        { id: 'oi-1', orderId: ORDER_ID, mediaItemId: 'media-1' },
        { id: 'oi-2', orderId: ORDER_ID, mediaItemId: 'media-2' },
      ],
    }));
    findMediaByIdsForFulfillment.mockResolvedValue(items);

    await fulfillOrder(ORDER_ID, EXTERNAL_ID);

    const [, , , earningsMap] = fulfill.mock.calls[0]!;
    expect(earningsMap.size).toBe(1);
    expect(earningsMap.get('p-1')).toBe(24);
  });

  it('splits earnings correctly when photographers differ', async () => {
    const items = [
      makeMediaItem({ id: 'media-1', price: 10, photographerId: 'p-1' }),
      makeMediaItem({ id: 'media-2', price: 20, photographerId: 'p-2' }),
    ];
    findOrderByExternalId.mockResolvedValue(null);
    findOrderById.mockResolvedValue(makeOrder({
      items: [
        { id: 'oi-1', orderId: ORDER_ID, mediaItemId: 'media-1' },
        { id: 'oi-2', orderId: ORDER_ID, mediaItemId: 'media-2' },
      ],
    }));
    findMediaByIdsForFulfillment.mockResolvedValue(items);

    await fulfillOrder(ORDER_ID, EXTERNAL_ID);

    const [, , purchases, earningsMap] = fulfill.mock.calls[0]!;
    expect(purchases).toHaveLength(2);
    expect(earningsMap.get('p-1')).toBe(8);
    expect(earningsMap.get('p-2')).toBe(16);
  });

  // -------------------------------------------------------------------------
  // Security: itemIds sourced from DB, not the webhook payload
  // -------------------------------------------------------------------------

  it('resolves media from DB order items — not from the webhook payload', async () => {
    setupHappyPath();

    await fulfillOrder(ORDER_ID, EXTERNAL_ID);

    expect(findMediaByIdsForFulfillment).toHaveBeenCalledWith(['media-1']);
  });
});
