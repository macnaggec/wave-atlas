import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'test/setup/render';
import { formatPrice } from 'shared/lib/currency';
import PublicCard, { type DisplayMedia } from './PublicCard';

const media: DisplayMedia = {
  id: 'media-1',
  thumbnailUrl: 'https://example.com/thumb.jpg',
  price: 300,
  capturedAt: new Date('2026-04-01T10:00:00Z'),
  resource: { resourceType: 'image', url: 'https://example.com/photo.jpg', assetId: 'asset-1' },
};

describe('PublicCard favorites action', () => {
  it('labels an active favorite as removable and emits the favorites action', () => {
    const onAction = vi.fn();
    render(<PublicCard mediaItem={media} actions={['favorites']} activeActions={['favorites']} onAction={onAction} />);

    fireEvent.click(screen.getByRole('button', { name: 'Remove from favorites' }));

    expect(onAction).toHaveBeenCalledWith('favorites', 'media-1');
  });

  it('fills the thumbnail heart when favorite state becomes active', () => {
    const { rerender } = render(
      <PublicCard mediaItem={media} actions={['favorites']} activeActions={[]} />,
    );

    expect(screen.getByRole('button', { name: 'Add to favorites' }).querySelector('svg'))
      .toHaveAttribute('fill', 'none');

    rerender(
      <PublicCard mediaItem={media} actions={['favorites']} activeActions={['favorites']} />,
    );

    expect(screen.getByRole('button', { name: 'Remove from favorites' }).querySelector('svg'))
      .toHaveAttribute('fill', 'currentColor');
  });
});

describe('PublicCard standard overlays', () => {
  it('renders the price badge, capture date, and thumbnail in normal mode', () => {
    render(<PublicCard mediaItem={media} actions={['cart']} activeActions={[]} />);

    expect(screen.getByText(formatPrice(300))).toBeInTheDocument();
    expect(screen.getByText(new Date(media.capturedAt).toLocaleDateString())).toBeInTheDocument();
    expect(screen.getByAltText('Media asset-1')).toHaveAttribute('src', media.thumbnailUrl);
  });

  it('shows the full Purchased badge in normal mode', () => {
    render(<PublicCard mediaItem={media} showPurchasedBadge />);

    expect(screen.getByText('Purchased')).toBeInTheDocument();
  });
});

describe('PublicCard dense state glyph', () => {
  it('shows one priority glyph (in-cart over favorited), no action buttons, no price', () => {
    render(
      <PublicCard
        mediaItem={media}
        actions={['cart', 'favorites']}
        activeActions={['cart', 'favorites']}
        dense
      />,
    );

    expect(screen.getByLabelText('In cart')).toBeInTheDocument();
    expect(screen.queryByLabelText('Favorited')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /cart|favorit/i })).not.toBeInTheDocument();
    expect(screen.queryByText(formatPrice(300))).not.toBeInTheDocument();
  });

  it('ranks purchased above cart and favorited', () => {
    render(
      <PublicCard
        mediaItem={media}
        activeActions={['cart', 'favorites']}
        showPurchasedBadge
        dense
      />,
    );

    expect(screen.getByLabelText('Purchased')).toBeInTheDocument();
    expect(screen.queryByLabelText('In cart')).not.toBeInTheDocument();
  });

  it('renders no glyph when the tile has no active state', () => {
    render(<PublicCard mediaItem={media} actions={['cart', 'favorites']} activeActions={[]} dense />);

    expect(screen.queryByLabelText('In cart')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Favorited')).not.toBeInTheDocument();
  });
});
