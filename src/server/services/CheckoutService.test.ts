import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CheckoutService } from 'server/services/CheckoutService';
import type { IOrderRepository, OrderWithItems } from 'server/repositories/OrderRepository';
import type { IMediaRepository } from 'server/repositories/MediaRepository';
import type { IPurchaseRepository, PurchaseWithMedia } from 'server/repositories/PurchaseRepository';
import type { PaymentAdapter } from 'server/lib/payment/PaymentAdapter';
import type { ICloudinaryService } from 'server/services/CloudinaryService';
import { BadRequestError, BadGatewayError, ForbiddenError } from 'shared/errors';
import type { IMediaImportService } from 'server/services/MediaImportService';
import { MediaImportSource } from '@prisma/client';

// ---------------------------------------------------------------------------
// Inline mocks — no vi.mock() needed with constructor injection
// ---------------------------------------------------------------------------

const mockOrders = {
  createOrder: vi.fn(),
  markOrderFailed: vi.fn(),
};

const mockMedia = {
  findByIds: vi.fn(),
};

const mockPurchases = {
  findByBuyer: vi.fn(),
  findByBuyerAndMedia: vi.fn(),
  findByDownloadToken: vi.fn(),
  findByIdAndOrder: vi.fn(),
  findPurchasedItemIds: vi.fn(),
};

const mockPayment = {
  createCheckoutSession: vi.fn(),
};

const mockCloudinary = {
  generateSignedDownload: vi.fn(),
};

const mockImporter = {
  importFromRemote: vi.fn(),
  importForDownload: vi.fn(),
  verifyRemoteAvailability: vi.fn(),
};

const service = new CheckoutService(
  mockOrders as unknown as IOrderRepository,
  mockMedia as unknown as IMediaRepository,
  mockPurchases as unknown as IPurchaseRepository,
  mockPayment as unknown as PaymentAdapter,
  mockCloudinary as unknown as ICloudinaryService,
  mockImporter as unknown as IMediaImportService,
);

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Factories — minimal valid shapes the mocks need to return
// ---------------------------------------------------------------------------

function makeMediaItem(overrides: Partial<{
  id: string;
  status: string;
  price: number;
  photographerId: string;
  importSource: string;
  remoteFileId: string | null;
}> = {}) {
  return {
    id: 'media-1',
    status: 'PUBLISHED',
    price: 1000,
    photographerId: 'photographer-1',
    importSource: MediaImportSource.DIRECT,
    remoteFileId: null,
    ...overrides,
  };
}

function makeOrder(): OrderWithItems {
  return { id: 'order-uuid-1', buyerId: 'buyer-1' } as unknown as OrderWithItems;
}

function makePurchase(overrides: Partial<PurchaseWithMedia> = {}): PurchaseWithMedia {
  return {
    id: 'purchase-1',
    purchasedAt: new Date('2026-01-01'),
    amountPaid: 1000,
    previewUrl: 'https://res.cloudinary.com/preview.jpg',
    mediaItem: {
      id: 'media-1',
      cloudinaryPublicId: 'wave-atlas/photo-001',
      thumbnailUrl: 'https://res.cloudinary.com/thumb.jpg',
      importSource: MediaImportSource.DIRECT,
      remoteFileId: null,
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// createCheckoutSession
// ---------------------------------------------------------------------------

describe('CheckoutService.createCheckoutSession', () => {
  const BUYER_ID = 'buyer-uuid-1';
  const ITEM_IDS = ['media-1'];

  function setupHappyPath(items = [makeMediaItem()]) {
    mockMedia.findByIds.mockResolvedValue(items);
    mockPurchases.findPurchasedItemIds.mockResolvedValue([]);
    mockOrders.createOrder.mockResolvedValue(makeOrder());
    mockPayment.createCheckoutSession.mockResolvedValue({
      checkoutUrl: 'https://pay.cryptocloud.plus/mock-invoice',
    });
  }

  // ---
  // Happy path
  // ---

  it('returns checkoutUrl and orderId when cart is valid', async () => {
    setupHappyPath();

    const result = await service.createCheckoutSession(BUYER_ID, undefined, ITEM_IDS);

    expect(result.checkoutUrl).toBe('https://pay.cryptocloud.plus/mock-invoice');
    expect(result.orderId).toBe('order-uuid-1');
  });

  it('passes authenticated success URL to payment adapter when buyerId is set', async () => {
    setupHappyPath();

    await service.createCheckoutSession(BUYER_ID, undefined, ITEM_IDS);

    expect(mockPayment.createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({ successUrl: expect.stringContaining('/me/purchases') }),
    );
  });

  it('passes guest success URL to payment adapter when buyerId is null', async () => {
    mockMedia.findByIds.mockResolvedValue([makeMediaItem()]);
    mockOrders.createOrder.mockResolvedValue(makeOrder());
    mockPayment.createCheckoutSession.mockResolvedValue({
      checkoutUrl: 'https://pay.cryptocloud.plus/guest-invoice',
    });

    await service.createCheckoutSession(null, 'guest@example.com', ITEM_IDS);

    expect(mockPayment.createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({ successUrl: expect.stringContaining('/order-success') }),
    );
  });

  it('passes totalCents derived from DB prices — not from client input', async () => {
    const item1 = makeMediaItem({ id: 'media-1', price: 1550 });
    const item2 = makeMediaItem({ id: 'media-2', price: 950 });

    setupHappyPath([item1, item2]);

    await service.createCheckoutSession(BUYER_ID, undefined, ['media-1', 'media-2']);

    // 1550 + 950 = 2500 cents
    expect(mockPayment.createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({ totalCents: 2500 }),
    );
  });

  it('skips duplicate-purchase check for guest checkout (buyerId = null)', async () => {
    mockMedia.findByIds.mockResolvedValue([makeMediaItem()]);
    mockOrders.createOrder.mockResolvedValue(makeOrder());
    mockPayment.createCheckoutSession.mockResolvedValue({
      checkoutUrl: 'https://pay.cryptocloud.plus/guest-invoice',
    });

    await service.createCheckoutSession(null, 'guest@example.com', ITEM_IDS);

    expect(mockPurchases.findPurchasedItemIds).not.toHaveBeenCalled();
  });

  // ---
  // Validation failures
  // ---

  it('throws BadRequestError when cart is empty', async () => {
    await expect(service.createCheckoutSession(BUYER_ID, undefined, [])).rejects.toThrow(BadRequestError);
    await expect(service.createCheckoutSession(BUYER_ID, undefined, [])).rejects.toThrow('Cart is empty');
  });

  it('throws BadRequestError when an item id does not exist in DB', async () => {
    mockMedia.findByIds.mockResolvedValue([makeMediaItem()]);

    await expect(
      service.createCheckoutSession(BUYER_ID, undefined, ['media-1', 'media-UNKNOWN']),
    ).rejects.toThrow('One or more items not found');
  });

  it('throws BadRequestError when a cart item is not published', async () => {
    mockMedia.findByIds.mockResolvedValue([makeMediaItem({ id: 'media-1', status: 'DRAFT' })]);

    await expect(service.createCheckoutSession(BUYER_ID, undefined, ITEM_IDS)).rejects.toThrow(
      'Some items are no longer available',
    );
  });

  it('throws BadRequestError when a DRIVE_PENDING item is in the cart',
    async () => {
      mockMedia.findByIds.mockResolvedValue([makeMediaItem({ id: 'media-1', status: 'DRIVE_PENDING' })]);

      await expect(service.createCheckoutSession(BUYER_ID, undefined, ITEM_IDS)).rejects.toThrow(
        'Some items are no longer available',
      );
    });

  it('throws BadRequestError when buyer tries to purchase their own media', async () => {
    mockMedia.findByIds.mockResolvedValue([makeMediaItem({ photographerId: BUYER_ID })]);

    await expect(service.createCheckoutSession(BUYER_ID, undefined, ITEM_IDS)).rejects.toThrow(
      'You cannot purchase your own media',
    );
  });

  it('throws BadRequestError when buyer already purchased an item', async () => {
    mockMedia.findByIds.mockResolvedValue([makeMediaItem()]);
    mockPurchases.findPurchasedItemIds.mockResolvedValue(['media-1']);

    await expect(service.createCheckoutSession(BUYER_ID, undefined, ITEM_IDS)).rejects.toThrow(
      'Some items already purchased',
    );
  });

  // ---
  // Payment adapter failure
  // ---

  it('marks the order as FAILED and throws BadGatewayError when payment adapter rejects', async () => {
    mockMedia.findByIds.mockResolvedValue([makeMediaItem()]);
    mockPurchases.findPurchasedItemIds.mockResolvedValue([]);
    mockOrders.createOrder.mockResolvedValue(makeOrder());
    mockOrders.markOrderFailed.mockResolvedValue({});
    mockPayment.createCheckoutSession.mockRejectedValue(new Error('CryptoCloud down'));

    await expect(service.createCheckoutSession(BUYER_ID, undefined, ITEM_IDS)).rejects.toThrow(BadGatewayError);
    expect(mockOrders.markOrderFailed).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// getPurchases
// ---------------------------------------------------------------------------

describe('CheckoutService.getPurchases', () => {
  it('returns mapped purchases for the buyer', async () => {
    const purchase = makePurchase();
    mockPurchases.findByBuyer.mockResolvedValue([purchase]);

    const result = await service.getPurchases('buyer-1');

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: 'purchase-1',
      purchasedAt: purchase.purchasedAt,
      amountPaid: 1000,
      previewUrl: 'https://res.cloudinary.com/preview.jpg',
      mediaItem: {
        id: 'media-1',
        thumbnailUrl: 'https://res.cloudinary.com/thumb.jpg',
      },
    });
  });

  it('returns an empty array when the buyer has no purchases', async () => {
    mockPurchases.findByBuyer.mockResolvedValue([]);

    const result = await service.getPurchases('buyer-1');

    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// generateDownloadAccess
// ---------------------------------------------------------------------------

describe('CheckoutService.generateDownloadAccess', () => {
  it('returns a signed download URL when purchase exists', async () => {
    mockPurchases.findByBuyerAndMedia.mockResolvedValue(makePurchase());
    mockCloudinary.generateSignedDownload.mockResolvedValue({
      downloadUrl: 'https://res.cloudinary.com/signed',
      expiresAt: 9999999999,
    });

    const result = await service.generateDownloadAccess('buyer-1', 'media-1');

    expect(result.downloadUrl).toBe('https://res.cloudinary.com/signed');
    expect(mockCloudinary.generateSignedDownload).toHaveBeenCalledWith('wave-atlas/photo-001');
  });

  it('throws ForbiddenError when purchase does not exist', async () => {
    mockPurchases.findByBuyerAndMedia.mockResolvedValue(null);

    await expect(service.generateDownloadAccess('buyer-1', 'media-1')).rejects.toThrow(ForbiddenError);
    await expect(service.generateDownloadAccess('buyer-1', 'media-1')).rejects.toThrow(
      'You have not purchased this item',
    );
  });
});

// ---------------------------------------------------------------------------
// generateDownloadAccessByToken
// ---------------------------------------------------------------------------

describe('CheckoutService.generateDownloadAccessByToken', () => {
  it('returns a signed download URL when token is valid', async () => {
    mockPurchases.findByDownloadToken.mockResolvedValue(makePurchase());
    mockCloudinary.generateSignedDownload.mockResolvedValue({
      downloadUrl: 'https://res.cloudinary.com/signed-token',
      expiresAt: 9999999999,
    });

    const result = await service.generateDownloadAccessByToken('valid-token-abc');

    expect(result.downloadUrl).toBe('https://res.cloudinary.com/signed-token');
    expect(mockCloudinary.generateSignedDownload).toHaveBeenCalledWith('wave-atlas/photo-001');
  });

  it('throws ForbiddenError when token is invalid or not found', async () => {
    mockPurchases.findByDownloadToken.mockResolvedValue(null);

    await expect(service.generateDownloadAccessByToken('bad-token')).rejects.toThrow(ForbiddenError);
    await expect(service.generateDownloadAccessByToken('bad-token')).rejects.toThrow(
      'Invalid or expired download token',
    );
  });
});

// ---------------------------------------------------------------------------
// getGuestDownloadAccess
// ---------------------------------------------------------------------------

describe('CheckoutService.getGuestDownloadAccess', () => {
  it('returns a signed download URL when purchaseId + orderId match', async () => {
    mockPurchases.findByIdAndOrder.mockResolvedValue(makePurchase());
    mockCloudinary.generateSignedDownload.mockResolvedValue({
      downloadUrl: 'https://res.cloudinary.com/signed-guest',
      expiresAt: 9999999999,
    });

    const result = await service.getGuestDownloadAccess('purchase-1', 'order-1');

    expect(result.downloadUrl).toBe('https://res.cloudinary.com/signed-guest');
    expect(mockPurchases.findByIdAndOrder).toHaveBeenCalledWith('purchase-1', 'order-1');
  });

  it('throws ForbiddenError when purchaseId does not belong to the given orderId', async () => {
    mockPurchases.findByIdAndOrder.mockResolvedValue(null);

    await expect(service.getGuestDownloadAccess('purchase-1', 'wrong-order')).rejects.toThrow(ForbiddenError);
    await expect(service.getGuestDownloadAccess('purchase-1', 'wrong-order')).rejects.toThrow(
      'Purchase not found',
    );
  });
});

// ---------------------------------------------------------------------------
// assertDriveItemsAvailable — via createCheckoutSession
// ---------------------------------------------------------------------------

describe('CheckoutService — Drive availability check', () => {
  const BUYER_ID = 'buyer-uuid-1';
  const ITEM_IDS = ['media-1'];

  function setupCheckout(items: ReturnType<typeof makeMediaItem>[]) {
    mockMedia.findByIds.mockResolvedValue(items);
    mockPurchases.findPurchasedItemIds.mockResolvedValue([]);
    mockOrders.createOrder.mockResolvedValue(makeOrder());
    mockPayment.createCheckoutSession.mockResolvedValue({
      checkoutUrl: 'https://pay.cryptocloud.plus/mock-invoice',
    });
  }

  it('does not call verifyRemoteAvailability for DIRECT items', async () => {
    setupCheckout([makeMediaItem()]);

    await service.createCheckoutSession(BUYER_ID, undefined, ITEM_IDS);

    expect(mockImporter.verifyRemoteAvailability).not.toHaveBeenCalled();
  });

  it('calls verifyRemoteAvailability with the item importSource for GOOGLE_DRIVE items', async () => {
    const driveItem = makeMediaItem({
      importSource: MediaImportSource.GOOGLE_DRIVE,
      remoteFileId: 'drive-file-abc',
    });
    setupCheckout([driveItem]);
    mockImporter.verifyRemoteAvailability.mockResolvedValue(true);

    await service.createCheckoutSession(BUYER_ID, undefined, ITEM_IDS);

    expect(mockImporter.verifyRemoteAvailability).toHaveBeenCalledWith(
      MediaImportSource.GOOGLE_DRIVE,
      'drive-file-abc',
    );
  });

  it('throws BadRequestError when a GOOGLE_DRIVE item is no longer available', async () => {
    const driveItem = makeMediaItem({
      id: 'media-drive-1',
      importSource: MediaImportSource.GOOGLE_DRIVE,
      remoteFileId: 'drive-file-gone',
    });
    mockMedia.findByIds.mockResolvedValue([driveItem]);
    mockImporter.verifyRemoteAvailability.mockResolvedValue(false);

    await expect(
      service.createCheckoutSession(BUYER_ID, undefined, ['media-drive-1']),
    ).rejects.toThrow('Some items are no longer available');
  });
});

// ---------------------------------------------------------------------------
// resolveDownload — DIRECT vs remote dispatch
// ---------------------------------------------------------------------------

describe('CheckoutService — resolveDownload dispatch', () => {
  it('calls cloudinary.generateSignedDownload for DIRECT purchases', async () => {
    const directPurchase = makePurchase();
    mockPurchases.findByBuyerAndMedia.mockResolvedValue(directPurchase);
    mockCloudinary.generateSignedDownload.mockReturnValue({
      downloadUrl: 'https://res.cloudinary.com/direct',
      expiresAt: 9999999999,
    });

    await service.generateDownloadAccess('buyer-1', 'media-1');

    expect(mockCloudinary.generateSignedDownload).toHaveBeenCalledWith('wave-atlas/photo-001');
    expect(mockImporter.importForDownload).not.toHaveBeenCalled();
  });

  it('calls importer.importForDownload for GOOGLE_DRIVE purchases', async () => {
    const drivePurchase = makePurchase({
      mediaItem: {
        id: 'media-drive-1',
        cloudinaryPublicId: '',
        thumbnailUrl: 'https://lh3.googleusercontent.com/thumb.jpg',
        importSource: MediaImportSource.GOOGLE_DRIVE,
        remoteFileId: 'drive-file-xyz',
      },
    });
    mockPurchases.findByBuyerAndMedia.mockResolvedValue(drivePurchase);
    mockImporter.importForDownload.mockResolvedValue({
      downloadUrl: 'https://drive.google.com/download-url',
      expiresAt: 9999999999,
    });

    const result = await service.generateDownloadAccess('buyer-1', 'media-drive-1');

    expect(mockImporter.importForDownload).toHaveBeenCalledWith(
      MediaImportSource.GOOGLE_DRIVE,
      'drive-file-xyz',
    );
    expect(mockCloudinary.generateSignedDownload).not.toHaveBeenCalled();
    expect(result.downloadUrl).toBe('https://drive.google.com/download-url');
  });
});

