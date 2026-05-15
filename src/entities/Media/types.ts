/**
 * Photo/Media Entity Types
 * Based on Prisma Photo model
 */

import { MediaResourceType, PhotoStatus } from './constants';

export interface MediaItem {
  id: string;
  photographerId: string;
  spotId: string;
  capturedAt: Date;
  dateSource?: 'exif' | 'fallback'; // Track if date came from EXIF metadata
  /** Price in cents (e.g. 300 = $3.00) */
  price: number;
  lightboxUrl: string;
  thumbnailUrl: string;
  cloudinaryPublicId: string;
  status: PhotoStatus;
  createdAt: Date;
  /** Non-null for DRIVE_PENDING and Drive-sourced PUBLISHED items. */
  remoteFileId?: string | null;
  importSource?: string;
  resource: {
    resource_type: MediaResourceType;
    url: string;
    playback_url?: string;
    asset_id: string;
  };
}

/** Mirrors Prisma MediaType enum without importing Prisma. */
export type MediaType = 'PHOTO' | 'VIDEO';

/**
 * Shape returned by findPublishedByPhotographer.
 * Carries the original media type and joined spot name needed by the uploads UI.
 */
export type PublishedMedia = {
  id: string;
  type: MediaType;
  lightboxUrl: string;
  price: number;
  capturedAt: Date;
  spotId: string;
  photographerId: string;
  spot: { id: string; name: string } | null;
};

/**
 * MediaItem enriched with the linked photographer.
 * Used in SpotDetails.mediaItems for the public gallery.
 */
export type SpotMediaItem = MediaItem & {
  photographer: { id: string; name: string | null } | null;
};
