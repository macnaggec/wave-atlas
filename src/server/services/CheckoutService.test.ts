import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CheckoutService } from 'server/services/CheckoutService';
import type { IOrderRepository } from 'server/repositories/OrderRepository';
import type { IMediaRepository } from 'server/repositories/MediaRepository';
import type { IPurchaseRepository } from 'server/repositories/PurchaseRepository';
import type { PaymentAdapter } from 'server/lib/payment/PaymentAdapter';
import type { ICloudinaryService } from 'server/services/CloudinaryService';
import type { OrderWithItems } from 'server/repositories/OrderRepository';
import { BadRequestError, BadGatewayError } from 'shared/errors';

// ---------------------------------------------------------------------------
// Inline mocks — no vi.mock() needed with constructor injection
// ---------------------------------------------------------------------------

const mockOrders = {
  createOrder: vi.fn(),
  findOrderById: vi.fn(),
  findOrderByExternalId: vi.fn(),
  markOrderFailed: vi.fn(),
};

const mockMedia = {
  findByIds: vi.fn(),
};

const mockPurchases = {
  findByBuyer: vi.fn(),
  findByBuyerAndMedia: vi.fn(),
  findPurchasedItemIds: vi.fn(),
};

const mockPayment = {
  createCheckoutSession: vi.fn(),
  verifyWebhook: vi.fn(),
  parseWebhookEvent: vi.fn(),
};

const mockCloudinary = {
  generateSignedDownload: vi.fn(),
  tryGeneratePermanentPreviewUrl: vi.fn(),
};

const service = new CheckoutService(
  mockOrders as unknown as IOrderRepository,
  mockMedia as unknown as IMediaRepository,
  mockPurchases as unknown as IPurchaseRepository,
  mockPayment as unknown as PaymentAdapter,
  mockCloudinary as unknown as ICloudinaryService,
);

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  process.env.APP_URL = 'https://test.wave-atlas.com';
});

// ---------------------------------------------------------------------------
// Factories — minimal valid shapes the mocks need to return
// ---------------------------------------------------------------------------

function makeMediaItem(overrides: Partial<{
  id: string;
  status: string;
  price: number;
  photographerId: string;
}> = {}) {
  return {
    id: 'media-1',
    status: 'PUBLISHED',
    price: 1000,
    photographerId: 'photographer-1',
    ...overrides,
  };
}

function makeOrder(mediaItemIds: string[]): OrderWithItems {
  return {
    id: 'order-uuid-1',
    buyerId: 'buyer-1',
    items: mediaItemIds.map((mediaItemId, i) => ({
      id: `item-${i}`,
      orderId: 'order-uuid-1',
      mediaItemId,
    })),
  } as unknown as OrderWithItems;
}

// ---------------------------------------------------------------------------
// Helpers — wire up the happy-path mocks in one call
// ---------------------------------------------------------------------------

function setupHappyPath(items = [makeMediaItem()]) {
  mockMedia.findByIds.mockResolvedValue(items);
  mockPurchases.findPurchasedItemIds.mockResolvedValue([]);
  mockOrders.createOrder.mockResolvedValue(makeOrder(items.map((m) => m.id)));
  mockPayment.createCheckoutSession.mockResolvedValue({
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

    const result = await service.createCheckoutSession(BUYER_ID, ITEM_IDS);

    expect(result.checkoutUrl).toBe(
      'https://pay.cryptocloud.plus/mock-invoice'
    );
    expect(result.orderId).toBe('order-uuid-1');
  });

  it('creates the order before calling the payment adapter', async () => {
    setupHappyPath();

    await service.createCheckoutSession(BUYER_ID, ITEM_IDS);

    const orderCallOrder = mockOrders.createOrder.mock.invocationCallOrder[0];
    const paymentCallOrder = mockPayment.createCheckoutSession.mock.invocationCallOrder[0];

    expect(orderCallOrder).toBeLessThan(paymentCallOrder);
  });

  it('passes totalCents derived from DB prices — not from client input', async () => {
    const item1 = makeMediaItem({ id: 'media-1', price: 1550 });
    const item2 = makeMediaItem({ id: 'media-2', price: 950 });

    setupHappyPath([item1, item2]);

    await service.createCheckoutSession(BUYER_ID, ['media-1', 'media-2']);

    // 1550 + 950 = 2500 cents
    expect(mockPayment.createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({ totalCents: 2500 }),
    );
  });

  // ---
  // Validation failures
  // ---

  it('throws BadRequestError when cart is empty', async () => {
    await expect(service.createCheckoutSession(BUYER_ID, [])).rejects.toThrow(BadRequestError);
    await expect(service.createCheckoutSession(BUYER_ID, [])).rejects.toThrow('Cart is empty');
  });

  it('throws BadRequestError when an item id does not exist in DB', async () => {
    // DB returns fewer items than requested — one id is unknown
    mockMedia.findByIds.mockResolvedValue([makeMediaItem()]);

    await expect(
      service.createCheckoutSession(BUYER_ID, ['media-1', 'media-UNKNOWN']),
    ).rejects.toThrow('One or more items not found');
  });

  it('throws BadRequestError when a cart item is not published', async () => {
    mockMedia.findByIds.mockResolvedValue([
      makeMediaItem({ id: 'media-1', status: 'DRAFT' }),
    ]);

    await expect(service.createCheckoutSession(BUYER_ID, ITEM_IDS)).rejects.toThrow(
      'Some items are no longer available',
    );
  });

  it('throws BadRequestError when buyer already purchased an item', async () => {
    mockMedia.findByIds.mockResolvedValue([makeMediaItem()]);
    mockPurchases.findPurchasedItemIds.mockResolvedValue(['media-1']);

    await expect(service.createCheckoutSession(BUYER_ID, ITEM_IDS)).rejects.toThrow(
      'Some items already purchased',
    );
  });

  // ---
  // Payment adapter failure
  // ---

  it('marks the order as FAILED and throws BadGatewayError when payment adapter rejects', async () => {
    mockMedia.findByIds.mockResolvedValue([makeMediaItem()]);
    mockPurchases.findPurchasedItemIds.mockResolvedValue([]);
    mockOrders.createOrder.mockResolvedValue(makeOrder(ITEM_IDS));
    mockOrders.markOrderFailed.mockResolvedValue({});
    mockPayment.createCheckoutSession.mockRejectedValue(new Error('CryptoCloud down'));

    await expect(service.createCheckoutSession(BUYER_ID, ITEM_IDS)).rejects.toThrow(BadGatewayError);
    expect(mockOrders.markOrderFailed).toHaveBeenCalledOnce();
  });
});

