import type { Cents } from './coordinates';

export const MEDIA_STATUS = {
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  DELETED: 'DELETED',
  DRIVE_PENDING: 'DRIVE_PENDING',
} as const;

export const MEDIA_RESOURCE_TYPE = {
  IMAGE: 'image',
  VIDEO: 'video',
} as const;

export const MEDIA_UPLOAD_LIMITS = {
  MAX_FILE_SIZE_IMAGE: 10 * 1024 * 1024,
  MAX_FILE_SIZE_VIDEO: 50 * 1024 * 1024,
  MAX_FILES_PER_BATCH: 20,
  MAX_BATCH_SIZE: 200 * 1024 * 1024,
} as const;

/** Minimum media price in cents. All published media must cost at least $3.00. */
export const MIN_MEDIA_PRICE_CENTS: Cents = 300;

export type MediaStatus = typeof MEDIA_STATUS[keyof typeof MEDIA_STATUS];
export type MediaResourceType = typeof MEDIA_RESOURCE_TYPE[keyof typeof MEDIA_RESOURCE_TYPE];

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
};
