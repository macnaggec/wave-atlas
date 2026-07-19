import { MediaItem as PrismaMediaItem, MediaType } from '@prisma/client';
import { MEDIA_RESOURCE_TYPE } from 'shared/constants/media';
import type { MediaItem } from 'shared/types/media';

export function mapToMediaItem(row: PrismaMediaItem): MediaItem {
  return {
    id: row.id,
    sessionId: row.sessionId,
    photographerId: row.photographerId,
    spotId: row.spotId ?? null,
    capturedAt: row.capturedAt,
    price: row.price ?? null,
    lightboxUrl: row.lightboxUrl,
    thumbnailUrl: row.thumbnailUrl,
    cloudinaryPublicId: row.cloudinaryPublicId,
    width: row.width,
    height: row.height,
    status: row.status,
    createdAt: row.createdAt,
    resource: {
      resourceType: row.type === MediaType.VIDEO
        ? MEDIA_RESOURCE_TYPE.VIDEO
        : MEDIA_RESOURCE_TYPE.IMAGE,
      url: row.lightboxUrl,
      assetId: row.id,
    },
  };
}
