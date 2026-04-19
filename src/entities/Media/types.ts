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
  resource: {
    resource_type: MediaResourceType;
    url: string;
    playback_url?: string;
    asset_id: string;
  };
}
