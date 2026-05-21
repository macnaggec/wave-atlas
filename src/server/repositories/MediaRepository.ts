import { MediaItem as PrismaMediaItem, MediaStatus, MediaType } from '@prisma/client';
import { MEDIA_STATUS, MEDIA_CLOUDINARY_TRANSFORMS } from 'entities/Media/constants';
import type { MediaItem, PublishedMedia } from 'entities/Media/types';
import type { MediaStatus as DomainMediaStatus } from 'entities/Media/constants';
import { prisma } from 'server/db';
import { runQuery } from 'shared/errors/PrismaErrorMapper';
import { mapToMediaItem, toSignedUrl } from './mappers';

export { mapToMediaItem };

function mapToPublishedMedia(
  row: PrismaMediaItem & { spot: { id: string; name: string } | null },
): PublishedMedia {
  return {
    id: row.id,
    type: row.type,
    lightboxUrl: toSignedUrl(row.cloudinaryPublicId, MEDIA_CLOUDINARY_TRANSFORMS.LIGHTBOX_WATERMARK),
    price: row.price,
    capturedAt: row.capturedAt,
    spotId: row.spotId,
    photographerId: row.photographerId,
    spot: row.spot,
  };
}

export type CreateMediaData = {
  spotId: string;
  photographerId: string;
  resource_type: 'image' | 'video';
  cloudinaryPublicId: string;
  thumbnailUrl: string;
  lightboxUrl: string;
  capturedAt: Date;
  price: number;
  status: DomainMediaStatus;
};

export type UpdateMediaData = { price?: number; status?: DomainMediaStatus; capturedAt?: Date };

export type MediaFulfillmentItem = {
  id: string;
  price: number;
  photographerId: string;
  cloudinaryPublicId: string;
};

export interface IMediaRepository {
  createMedia(data: CreateMediaData): Promise<MediaItem>;
  findById(id: string): Promise<MediaItem | null>;
  updateMedia(id: string, data: UpdateMediaData): Promise<MediaItem>;
  softDelete(id: string): Promise<MediaItem>;
  hardDelete(id: string): Promise<void>;
  findByIds(ids: string[]): Promise<{ id: string; status: DomainMediaStatus; price: number; photographerId: string }[]>;
  findByIdsForFulfillment(ids: string[]): Promise<MediaFulfillmentItem[]>;
  findPublishedByPhotographer(photographerId: string): Promise<PublishedMedia[]>;
  countDraftsBySpot(photographerId: string): Promise<{ spotId: string; spotName: string; count: number }[]>;
}

export class MediaRepository implements IMediaRepository {
  createMedia(data: CreateMediaData): Promise<MediaItem> {
    return runQuery(async () => {
      const row = await prisma.mediaItem.create({
        data: {
          spotId: data.spotId,
          photographerId: data.photographerId,
          type: data.resource_type === 'video' ? MediaType.VIDEO : MediaType.PHOTO,
          cloudinaryPublicId: data.cloudinaryPublicId,
          thumbnailUrl: data.thumbnailUrl,
          lightboxUrl: data.lightboxUrl,
          capturedAt: data.capturedAt,
          price: data.price,
          status: data.status as MediaStatus,
        },
      });
      return mapToMediaItem(row);
    });
  }

  findById(id: string): Promise<MediaItem | null> {
    return runQuery(async () => {
      const row = await prisma.mediaItem.findUnique({ where: { id } });
      return row ? mapToMediaItem(row) : null;
    });
  }

  updateMedia(id: string, data: UpdateMediaData): Promise<MediaItem> {
    return runQuery(async () => {
      const row = await prisma.mediaItem.update({ where: { id }, data });
      return mapToMediaItem(row);
    });
  }

  softDelete(id: string): Promise<MediaItem> {
    return runQuery(async () => {
      const row = await prisma.mediaItem.update({
        where: { id },
        data: { status: MEDIA_STATUS.DELETED, deletedAt: new Date() },
      });
      return mapToMediaItem(row);
    });
  }

  hardDelete(id: string): Promise<void> {
    return runQuery(async () => {
      await prisma.mediaItem.delete({ where: { id } });
    });
  }

  findByIds(ids: string[]): Promise<{ id: string; status: DomainMediaStatus; price: number; photographerId: string }[]> {
    return runQuery(async () => {
      const rows = await prisma.mediaItem.findMany({
        where: { id: { in: ids } },
        select: { id: true, status: true, price: true, photographerId: true },
      });
      return rows as { id: string; status: DomainMediaStatus; price: number; photographerId: string }[];
    });
  }

  findByIdsForFulfillment(ids: string[]): Promise<MediaFulfillmentItem[]> {
    return runQuery(async () => {
      return prisma.mediaItem.findMany({
        where: { id: { in: ids } },
        select: { id: true, price: true, photographerId: true, cloudinaryPublicId: true },
      });
    });
  }

  findPublishedByPhotographer(photographerId: string): Promise<PublishedMedia[]> {
    return runQuery(async () => {
      const rows = await prisma.mediaItem.findMany({
        where: { photographerId, status: MEDIA_STATUS.PUBLISHED, deletedAt: null },
        orderBy: { capturedAt: 'desc' },
        include: { spot: { select: { id: true, name: true } } },
      });
      return rows.map(mapToPublishedMedia);
    });
  }

  countDraftsBySpot(photographerId: string): Promise<{ spotId: string; spotName: string; count: number }[]> {
    return runQuery(async () => {
      const grouped = await prisma.mediaItem.groupBy({
        by: ['spotId'],
        where: { photographerId, status: MEDIA_STATUS.DRAFT, deletedAt: null },
        _count: { id: true },
      });

      if (grouped.length === 0) return [];

      const spots = await prisma.spot.findMany({
        where: { id: { in: grouped.map((g) => g.spotId) } },
        select: { id: true, name: true },
      });

      const spotMap = new Map(spots.map((s) => [s.id, s.name]));

      return grouped.map((g) => ({
        spotId: g.spotId,
        spotName: spotMap.get(g.spotId) ?? 'Unknown spot',
        count: g._count.id,
      }));
    });
  }

}

export const mediaRepository = new MediaRepository();


