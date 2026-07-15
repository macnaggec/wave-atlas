import type { Cents } from './coordinates';
import type { MediaResourceType, MediaStatus } from '../constants/media';

export type { MediaResourceType, MediaStatus } from '../constants/media';

export type ViewerPurchaseState = 'none' | 'purchased';

export interface ViewerMediaEntitlement {
  purchaseState: ViewerPurchaseState;
}

export interface MediaItem {
  id: string;
  sessionId: string;
  photographerId: string;
  /** Null on drafts; set at publish time. */
  spotId: string | null;
  capturedAt: Date;
  dateSource?: 'exif' | 'fallback';
  /** Price in cents (e.g. 300 = $3.00). Null on drafts; set at publish time. */
  price: Cents | null;
  lightboxUrl: string;
  thumbnailUrl: string;
  cloudinaryPublicId: string;
  status: MediaStatus;
  createdAt: Date;
  resource: {
    resourceType: MediaResourceType;
    url: string;
    playbackUrl?: string;
    assetId: string;
  };
}

/** Mirrors Prisma MediaType enum without importing Prisma. */
export type MediaType = 'PHOTO' | 'VIDEO';

export type PublishedMedia = {
  id: string;
  type: MediaType;
  lightboxUrl: string;
  thumbnailUrl: string;
  price: Cents;
  capturedAt: Date;
  spotId: string;
  photographerId: string;
  spot: { id: string; name: string } | null;
};

export type SpotMediaItem = MediaItem & {
  photographer: { id: string; name: string | null } | null;
  spot: { id: string; name: string } | null;
};

export type PublicMediaItem = MediaItem & {
  viewerEntitlement: ViewerMediaEntitlement;
};

export type PublicPublishedMedia = PublishedMedia & {
  viewerEntitlement: ViewerMediaEntitlement;
};

export type PublicSpotMediaItem = SpotMediaItem & {
  viewerEntitlement: ViewerMediaEntitlement;
};

export type PublicSpotMediaPage = {
  items: PublicSpotMediaItem[];
  nextCursor: string | null;
};
