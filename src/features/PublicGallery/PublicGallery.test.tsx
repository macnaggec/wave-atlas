import React from 'react';
import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'test/setup/render';
import PublicGallery from './PublicGallery';
import type { PublicMediaItem } from 'entities/Media';

const mediaItem: PublicMediaItem = {
  id: 'media-1',
  sessionId: 'session-1',
  photographerId: 'photographer-1',
  spotId: 'spot-1',
  capturedAt: new Date('2026-04-01T10:00:00.000Z'),
  price: 300,
  lightboxUrl: 'https://example.com/lightbox.jpg',
  thumbnailUrl: 'https://example.com/thumb.jpg',
  cloudinaryPublicId: 'cloudinary-public-id',
  status: 'PUBLISHED',
  createdAt: new Date('2026-04-01T12:00:00.000Z'),
  viewerEntitlement: { purchaseState: 'none' },
  resource: {
    resourceType: 'image',
    url: 'https://example.com/lightbox.jpg',
    assetId: 'media-1',
  },
};

const galleryState = vi.hoisted(() => ({
  flatItems: [] as PublicMediaItem[],
}));

vi.mock('entities/Spot', () => ({
  useSpotMediaFeed: () => ({
    flatItems: galleryState.flatItems,
    isLoading: false,
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
  }),
  useSpotPreview: () => ({ data: { name: 'Pipeline' } }),
}));

vi.mock('entities/Commerce', () => ({
  useCartToggle: () => ({ cartItemIds: new Set(), toggleCartItem: vi.fn() }),
  useCartStore: (selector: (state: { add: () => void }) => unknown) => selector({ add: vi.fn() }),
  toCartItem: vi.fn(),
}));

vi.mock('shared/hooks/useUser', () => ({
  useUser: () => ({ user: { id: 'buyer-1' }, isLoading: false }),
}));

vi.mock('entities/Media', async (importOriginal) => ({
  ...(await importOriginal<typeof import('entities/Media')>()),
  useMediaFavorites: () => ({ favoriteIds: new Set(), toggleFavorite: vi.fn() }),
}));

vi.mock('shared/ui/VirtualGallery/VirtualGallery', () => ({
  VirtualGallery: React.forwardRef(function VirtualGalleryMock(
    { toolbar }: { toolbar?: React.ReactNode },
    _ref,
  ) {
    return (
      <div data-testid="virtual-gallery">
        {toolbar && <div data-testid="gallery-toolbar">{toolbar}</div>}
      </div>
    );
  }),
}));

vi.mock('./ui/GalleryDateSidebar', () => ({
  GalleryDateSidebar: () => <div data-testid="gallery-date-sidebar" />,
}));

vi.mock('./ui/MediaLightbox', () => ({
  default: () => null,
}));

describe('PublicGallery', () => {
  beforeEach(() => {
    galleryState.flatItems = [mediaItem];
  });

  it('renders published media without a gallery-local selection toolbar', () => {
    render(<PublicGallery spotId="spot-1" />);

    expect(screen.getByTestId('virtual-gallery')).toBeInTheDocument();
    expect(screen.queryByTestId('gallery-toolbar')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Select' })).not.toBeInTheDocument();
  });

  it('offers to clear active filters when no media matches the current view', () => {
    galleryState.flatItems = [];
    const onClearFilters = vi.fn();

    render(
      <PublicGallery
        filters={{ date: { date: new Date('2026-07-01T00:00:00.000Z') }, favoriteSpotsOnly: false }}
        onClearFilters={onClearFilters}
      />,
    );

    expect(screen.getByRole('heading', { name: 'No shots match this view' })).toBeInTheDocument();
    expect(screen.getByText('Try another date to widen the gallery.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show all media' }));

    expect(onClearFilters).toHaveBeenCalledOnce();
  });

  it('guides an unfiltered empty gallery toward the existing upload action', () => {
    galleryState.flatItems = [];

    render(<PublicGallery />);

    expect(screen.getByRole('heading', { name: 'No shots here yet' })).toBeInTheDocument();
    expect(
      screen.getByText('Published photos and clips will show up here. Use Upload above to add the first set.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Show all media' })).not.toBeInTheDocument();
  });
});
