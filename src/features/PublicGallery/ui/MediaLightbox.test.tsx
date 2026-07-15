import { fireEvent, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { render } from 'test/setup/render';
import { formatPrice } from 'shared/lib/currency';
import MediaLightbox, { type LightboxMedia } from './MediaLightbox';

const mediaItem: LightboxMedia = {
  id: 'media-1',
  lightboxUrl: 'https://cdn.example.com/lightbox.jpg',
  thumbnailUrl: 'https://cdn.example.com/thumb.jpg',
  type: 'image',
  price: 300,
  capturedAt: new Date('2026-04-01T10:00:00.000Z'),
  photographerId: 'photographer-1',
};

describe('MediaLightbox', () => {
  beforeAll(() => {
    global.IntersectionObserver = class IntersectionObserverMock {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
      takeRecords = vi.fn(() => []);
    } as unknown as typeof IntersectionObserver;
  });

  it('puts media metadata in a caption above the image and cart actions in the control rail', () => {
    render(
      <MediaLightbox
        items={[mediaItem]}
        initialIndex={0}
        opened
        onClose={vi.fn()}
        onCartToggle={vi.fn()}
      />,
    );

    const price = screen.getByText(formatPrice(mediaItem.price ?? 0));
    expect(price.closest('[data-lightbox-media-caption]')).not.toBeNull();

    const addToCart = screen.getByRole('button', { name: 'Add to cart' });
    expect(addToCart).toHaveAttribute('data-lightbox-icon-action', 'true');
    expect(addToCart).toHaveAttribute('data-lightbox-icon-frame', 'chip');
    expect(addToCart).toHaveAttribute('data-lightbox-tooltip-layer', 'above-media');
    expect(addToCart.closest('[data-lightbox-control-rail]')).not.toBeNull();
    expect(addToCart.closest('[data-lightbox-media-caption]')).toBeNull();
  });

  it('shows favorite below cart and toggles the active favorite state', () => {
    const onFavoriteToggle = vi.fn();
    render(
      <MediaLightbox
        items={[mediaItem]}
        initialIndex={0}
        opened
        onClose={vi.fn()}
        onCartToggle={vi.fn()}
        favoriteItemIds={new Set([mediaItem.id])}
        onFavoriteToggle={onFavoriteToggle}
      />,
    );

    const cart = screen.getByRole('button', { name: 'Add to cart' });
    const favorite = screen.getByRole('button', { name: 'Remove from favorites' });
    expect(cart.compareDocumentPosition(favorite) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    fireEvent.click(favorite);
    expect(onFavoriteToggle).toHaveBeenCalledWith(mediaItem);
  });
});
