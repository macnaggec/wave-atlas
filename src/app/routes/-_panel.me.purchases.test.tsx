import { waitFor } from '@testing-library/react';
import type { ComponentType } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCartStore } from 'entities/Commerce/model/cartStore';
import type { CartItem } from 'entities/Commerce/model/types';
import { render } from 'test/setup/render';
import { Route } from './_panel.me.purchases';

const mocks = vi.hoisted(() => ({
  isLoading: false,
  purchases: [] as {
    id: string;
    purchasedAt: Date;
    amountPaid: number;
    previewUrl: string | null;
    mediaItem: { id: string; thumbnailUrl: string };
  }[],
  useSearch: vi.fn(() => ({ order: 'order-1' })),
}));

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: Record<string, unknown>) => ({
    ...options,
    useSearch: mocks.useSearch,
  }),
}));

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQuery: () => ({
      data: mocks.purchases,
      isLoading: mocks.isLoading,
    }),
  };
});

vi.mock('shared/lib/trpc', () => ({
  useTRPC: () => ({
    checkout: {
      myPurchases: {
        queryOptions: () => ({}),
      },
    },
  }),
}));

vi.mock('entities/Commerce', async () => {
  const { useCartStore } = await import('entities/Commerce/model/cartStore');
  return {
    useCartStore,
    usePurchaseDownload: () => ({
      download: vi.fn(),
      isDownloading: () => false,
      isAnyDownloading: false,
    }),
  };
});

vi.mock('features/Cart/ui/DownloadButton', () => ({
  default: () => <button type="button">Download</button>,
}));

vi.mock('features/Cart/ui/PurchaseLightbox', () => ({
  default: () => null,
}));

describe('PurchasesTab', () => {
  const purchasedItem: CartItem = {
    id: 'media-1',
    label: 'Pipeline · Jan 1, 2026',
    spotName: 'Pipeline',
    capturedAt: '2026-01-01T00:00:00.000Z',
    thumbnailUrl: 'https://example.com/thumb-1.jpg',
    lightboxUrl: 'https://example.com/preview-1.jpg',
    priceCents: 300,
  };
  const unpaidItem: CartItem = {
    id: 'media-2',
    label: 'Pipeline · Jan 2, 2026',
    spotName: 'Pipeline',
    capturedAt: '2026-01-02T00:00:00.000Z',
    thumbnailUrl: 'https://example.com/thumb-2.jpg',
    lightboxUrl: 'https://example.com/preview-2.jpg',
    priceCents: 400,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isLoading = false;
    mocks.purchases = [{
      id: 'purchase-1',
      purchasedAt: new Date('2026-01-03T00:00:00.000Z'),
      amountPaid: 300,
      previewUrl: null,
      mediaItem: { id: 'media-1', thumbnailUrl: 'https://example.com/thumb-1.jpg' },
    }];
    localStorage.clear();
    useCartStore.setState({ items: [purchasedItem, unpaidItem] });
  });

  it('removes fulfilled purchase items from the cart after a paid return', async () => {
    const Component = Route.component as ComponentType;

    render(<Component />);

    await waitFor(() => {
      expect(useCartStore.getState().items).toEqual([unpaidItem]);
    });
  });
});
