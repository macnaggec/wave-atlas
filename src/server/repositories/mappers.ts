import { MediaItem as PrismaMediaItem, MediaType } from '@prisma/client';
import { MEDIA_RESOURCE_TYPE, MEDIA_CLOUDINARY_TRANSFORMS } from 'entities/Media';
import type { MediaItem } from 'entities/Media';
import { generateDeliveryUrl } from 'server/lib/cloudinary';

export function toSignedUrl(cloudinaryPublicId: string, transform: string): string {
  return generateDeliveryUrl(cloudinaryPublicId, transform);
}

export function mapToMediaItem(row: PrismaMediaItem): MediaItem {
  const thumbnailUrl = toSignedUrl(row.cloudinaryPublicId, MEDIA_CLOUDINARY_TRANSFORMS.THUMBNAIL);
  const lightboxUrl = toSignedUrl(row.cloudinaryPublicId, MEDIA_CLOUDINARY_TRANSFORMS.LIGHTBOX_WATERMARK);
  return {
    id: row.id,
    photographerId: row.photographerId,
    spotId: row.spotId,
    capturedAt: row.capturedAt,
    price: row.price,
    lightboxUrl,
    thumbnailUrl,
    cloudinaryPublicId: row.cloudinaryPublicId,
    status: row.status,
    createdAt: row.createdAt,
    resource: {
      resource_type: row.type === MediaType.VIDEO
        ? MEDIA_RESOURCE_TYPE.VIDEO
        : MEDIA_RESOURCE_TYPE.IMAGE,
      url: lightboxUrl,
      asset_id: row.id,
    },
  };
}
