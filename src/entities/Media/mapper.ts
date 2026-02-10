/**
 * MediaMapper - Data transformation utilities
 *
 * Pure functions for transforming Prisma MediaItem to application MediaItem type.
 * Centralizes mapping logic to eliminate duplication and ensure consistency.
 */

import { MediaItem as PrismaMediaItem, MediaType } from '@prisma/client';
import { MediaItem } from './types';
import { MEDIA_RESOURCE_TYPE, PhotoStatus } from './constants';

/**
 * Maps Prisma MediaItem to application MediaItem type
 *
 * Handles:
 * - Decimal to number conversion for price
 * - Type assertion for status
 * - Resource type mapping (PHOTO/VIDEO)
 * - Resource object construction
 *
 * @param prismaMedia - MediaItem from Prisma query
 * @returns Transformed MediaItem for application use
 */
export function mapPrismaToMediaItem(prismaMedia: PrismaMediaItem): MediaItem {
  return {
    id: prismaMedia.id,
    photographerId: prismaMedia.photographerId,
    spotId: prismaMedia.spotId,
    capturedAt: prismaMedia.capturedAt,
    price: Number(prismaMedia.price),
    watermarkUrl: prismaMedia.watermarkUrl,
    originalUrl: prismaMedia.originalUrl,
    status: prismaMedia.status as PhotoStatus,
    createdAt: prismaMedia.createdAt,
    resource: {
      resource_type: prismaMedia.type === MediaType.VIDEO
        ? MEDIA_RESOURCE_TYPE.VIDEO
        : MEDIA_RESOURCE_TYPE.IMAGE,
      url: prismaMedia.watermarkUrl,
      asset_id: prismaMedia.id,
    },
  };
}

/**
 * Maps array of Prisma MediaItems to application MediaItems
 *
 * @param prismaMediaItems - Array of MediaItems from Prisma query
 * @returns Array of transformed MediaItems
 */
export function mapPrismaToMediaItems(prismaMediaItems: PrismaMediaItem[]): MediaItem[] {
  return prismaMediaItems.map(mapPrismaToMediaItem);
}
