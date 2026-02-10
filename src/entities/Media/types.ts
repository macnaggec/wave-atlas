/**
 * Photo/Media Entity Types
 * Based on Prisma Photo model
 */

import { MediaResourceType, PhotoStatus } from './constants';

export interface MediaResource {
  resource_type: MediaResourceType;
  url: string;
  playback_url?: string;
  asset_id: string;
}

export interface MediaItem {
  id: string;
  photographerId: string;
  spotId: string;
  capturedAt: Date;
  dateSource?: 'exif' | 'fallback'; // Track if date came from EXIF metadata
  price: number;
  watermarkUrl: string;
  originalUrl: string;
  status: PhotoStatus;
  createdAt: Date;
  resource: MediaResource;
}

export interface MediaUpdateParams {
  price?: number;
  status?: PhotoStatus;
}
