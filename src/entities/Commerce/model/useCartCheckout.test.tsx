import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCartStore } from './cartStore';
import { useCartCheckout } from './useCartCheckout';
import type { CartItem } from './types';

const mocks = vi.hoisted(() => ({
  mutationInput: undefined as { itemIds: string[] } | undefined,
}));

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useMutation: (options: {
      onSuccess?: (data: { checkoutUrl: string; orderId: string }) => void;
    }) => ({
      isPending: false,
      mutate: (input: { itemIds: string[] }) => {
        mocks.mutationInput = input;
        options.onSuccess?.({
          checkoutUrl: `${window.location.href}#checkout`,
          orderId: 'order-1',
        });
      },
    }),
  };
});

vi.mock('shared/lib/trpc', () => ({
  useTRPC: () => ({
    checkout: {
      create: {
        mutationOptions: () => ({}),
      },
    },
  }),
}));

const originalClear = useCartStore.getState().clear;

describe('useCartCheckout', () => {
  const item: CartItem = {
    id: 'media-1',
    label: 'Pipeline · Jan 1, 2026',
    spotName: 'Pipeline',
    capturedAt: '2026-01-01T00:00:00.000Z',
    thumbnailUrl: 'https://example.com/thumb.jpg',
    lightboxUrl: 'https://example.com/preview.jpg',
    priceCents: 300,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mutationInput = undefined;
    window.history.replaceState({}, '', '/cart');
    localStorage.clear();
    useCartStore.setState({
      items: [item],
      clear: vi.fn(),
    });
  });

  afterEach(() => {
    act(() => {
      useCartStore.setState({
        items: [],
        clear: originalClear,
      });
    });
  });

  it('keeps cart items after creating a checkout session', async () => {
    const { result } = renderHook(() => useCartCheckout());
    const clear = useCartStore.getState().clear;

    await act(async () => {
      result.current.handleCheckout();
    });

    expect(mocks.mutationInput).toEqual({ itemIds: ['media-1'] });
    expect(clear).not.toHaveBeenCalled();
  });
});
