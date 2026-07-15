import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { usePublicGalleryActions } from './usePublicGalleryActions';
import type { PublicMediaItem } from 'entities/Media';

vi.mock('shared/hooks/useUser', () => ({
  useUser: () => ({ user: { id: 'buyer-1' }, isLoading: false }),
}));

function mediaItem(overrides: Partial<PublicMediaItem> & { id: string }): PublicMediaItem {
  return {
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
      assetId: overrides.id,
    },
    ...overrides,
  };
}

describe('usePublicGalleryActions', () => {
  it('does not expose cart actions for media already purchased by the viewer', () => {
    const { result } = renderHook(() =>
      usePublicGalleryActions({
        cartItemIds: new Set(),
        favoriteItemIds: new Set(['media-1']),
        hasShare: false,
      }),
    );

    const purchasedItem = mediaItem({
      id: 'media-1',
      viewerEntitlement: { purchaseState: 'purchased' },
    });

    expect(result.current.getCardActions(purchasedItem, false)).toEqual({
      actions: ['favorites'],
      activeActions: ['favorites'],
      isOwn: false,
      isPurchased: true,
    });
    expect(result.current.getCartBulkState([purchasedItem])).toEqual({
      actions: [],
      noActionsLabel: 'All selected items are already purchased',
    });
  });
});
