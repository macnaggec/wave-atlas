import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { SessionDetail } from './SessionDetail';

const mocks = vi.hoisted(() => {
  const mediaItem = {
    id: 'media-1',
    type: 'PHOTO' as const,
    lightboxUrl: 'https://example.com/lightbox.jpg',
    thumbnailUrl: 'https://example.com/thumb.jpg',
    price: 300,
    capturedAt: new Date('2026-04-01T10:00:00.000Z'),
    spotId: 'spot-1',
    photographerId: 'photographer-1',
    spot: { id: 'spot-1', name: 'Pipeline' },
  };

  return {
    addToCart: vi.fn(),
    removeFromCart: vi.fn(),
    toCartItem: vi.fn(() => ({
      id: 'canonical-cart-item',
      label: 'Commerce-owned cart item',
      spotName: 'Pipeline',
      capturedAt: '2026-04-01T10:00:00.000Z',
      thumbnailUrl: 'https://example.com/thumb.jpg',
      lightboxUrl: 'https://example.com/lightbox.jpg',
      priceCents: 300,
    })),
    mediaItem,
  };
});

vi.mock('entities/SurfSession', () => ({
  useSessionMedia: () => ({ data: [mocks.mediaItem], isLoading: false }),
}));

vi.mock('entities/Commerce', () => ({
  useCartStore: (selector: (state: unknown) => unknown) => selector({
    items: [],
    add: mocks.addToCart,
    remove: mocks.removeFromCart,
  }),
  toCartItem: mocks.toCartItem,
}));

vi.mock('shared/hooks/useUser', () => ({
  useUser: () => ({ user: { id: 'buyer-1' } }),
}));

vi.mock('features/PublicGallery', () => ({
  PublicCard: ({ onAction }: { onAction?: () => void }) => (
    <button type="button" onClick={onAction}>Add to cart</button>
  ),
  MediaLightbox: () => null,
}));

vi.mock('shared/ui/BaseGallery', () => ({
  BaseGallery: ({
    items,
    renderCard,
  }: {
    items: Array<{ id: string }>;
    renderCard: (item: { id: string }, context: { index: number }) => ReactNode;
  }) => <>{items.map((item, index) => (
    <div key={item.id}>{renderCard(item, { index })}</div>
  ))}</>,
}));

describe('SessionDetail', () => {
  it('delegates cart-record construction to Commerce', async () => {
    const session = {
      id: 'session-1',
      spotId: 'spot-1',
      photographerId: 'photographer-1',
      startsAt: new Date('2026-04-01T09:00:00.000Z'),
      endsAt: new Date('2026-04-01T11:00:00.000Z'),
      status: 'PUBLISHED' as const,
      createdAt: new Date('2026-04-01T12:00:00.000Z'),
      spot: { id: 'spot-1', name: 'Pipeline', location: 'Oahu' },
      thumbnailUrl: mocks.mediaItem.thumbnailUrl,
      mediaCount: 1,
    };

    render(
      <MantineProvider>
        <SessionDetail session={session} />
      </MantineProvider>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Add to cart' }));

    expect(mocks.toCartItem).toHaveBeenCalledWith(mocks.mediaItem, 'Pipeline');
    expect(mocks.addToCart).toHaveBeenCalledWith(mocks.toCartItem.mock.results[0]?.value);
  });
});
