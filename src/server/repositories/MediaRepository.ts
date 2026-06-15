import { MediaItem as PrismaMediaItem, MediaStatus, MediaType } from '@prisma/client';
import { MEDIA_STATUS, MEDIA_CLOUDINARY_TRANSFORMS } from 'entities/Media';
import type { MediaItem, PublishedMedia, MediaStatus as DomainMediaStatus } from 'entities/Media';
import { prisma } from 'server/db';
import { runQuery } from 'shared/errors/PrismaErrorMapper';
import { mapToMediaItem, toSignedUrl } from './mappers';



function mapToPublishedMedia(
  row: PrismaMediaItem & { spot: { id: string; name: string } | null },
): PublishedMedia {
  return {
    id: row.id,
    type: row.type,
    lightboxUrl: toSignedUrl(row.cloudinaryPublicId, MEDIA_CLOUDINARY_TRANSFORMS.LIGHTBOX_WATERMARK),
    thumbnailUrl: toSignedUrl(row.cloudinaryPublicId, MEDIA_CLOUDINARY_TRANSFORMS.THUMBNAIL),
    price: row.price!,
    capturedAt: row.capturedAt,
    spotId: row.spotId!,
    photographerId: row.photographerId,
    spot: row.spot,
  };
}

export type CreateMediaData = {
  photographerId: string;
  resource_type: 'image' | 'video';
  cloudinaryPublicId: string;
  thumbnailUrl: string;
  lightboxUrl: string;
  capturedAt: Date;
  status: DomainMediaStatus;
};

export type UpdateMediaData = { price?: number; status?: DomainMediaStatus; capturedAt?: Date; spotId?: string };

export type MediaFulfillmentItem = {
  id: string;
  price: number;
  photographerId: string;
  cloudinaryPublicId: string;
};

export interface IMediaRepository {
  createMedia(data: CreateMediaData): Promise<MediaItem>;
  findById(id: string): Promise<MediaItem | null>;
  findByCloudinaryPublicId(publicId: string): Promise<{ id: string; photographerId: string } | null>;
  updateMedia(id: string, data: UpdateMediaData): Promise<MediaItem>;
  updateManyMedia(ids: string[], data: UpdateMediaData): Promise<void>;
  softDelete(id: string): Promise<MediaItem>;
  hardDelete(id: string): Promise<void>;
  findByIds(ids: string[]): Promise<{ id: string; status: DomainMediaStatus; price: number | null; photographerId: string }[]>;
  findByIdsForFulfillment(ids: string[]): Promise<MediaFulfillmentItem[]>;
  findPublishedByPhotographer(photographerId: string): Promise<PublishedMedia[]>;
  findPublishedBySession(sessionId: string): Promise<PublishedMedia[]>;
  hasDraftsByUser(photographerId: string): Promise<boolean>;
  findDraftsByUser(photographerId: string): Promise<MediaItem[]>;
}

export class MediaRepository implements IMediaRepository {
  createMedia(data: CreateMediaData): Promise<MediaItem> {
    return runQuery(async () => {
      const row = await prisma.mediaItem.create({
        data: {
          photographerId: data.photographerId,
          type: data.resource_type === 'video' ? MediaType.VIDEO : MediaType.PHOTO,
          cloudinaryPublicId: data.cloudinaryPublicId,
          thumbnailUrl: data.thumbnailUrl,
          lightboxUrl: data.lightboxUrl,
          capturedAt: data.capturedAt,
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

  findByCloudinaryPublicId(publicId: string): Promise<{ id: string; photographerId: string } | null> {
    return runQuery(async () => {
      const row = await prisma.mediaItem.findFirst({
        where: { cloudinaryPublicId: publicId },
        select: { id: true, photographerId: true },
      });
      return row ?? null;
    });
  }

  updateMedia(id: string, data: UpdateMediaData): Promise<MediaItem> {
    return runQuery(async () => {
      const row = await prisma.mediaItem.update({ where: { id }, data });
      return mapToMediaItem(row);
    });
  }

  updateManyMedia(ids: string[], data: UpdateMediaData): Promise<void> {
    return runQuery(async () => {
      await prisma.mediaItem.updateMany({ where: { id: { in: ids } }, data });
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

  findByIds(ids: string[]): Promise<{ id: string; status: DomainMediaStatus; price: number | null; photographerId: string }[]> {
    return runQuery(async () => {
      const rows = await prisma.mediaItem.findMany({
        where: { id: { in: ids } },
        select: { id: true, status: true, price: true, photographerId: true },
      });
      return rows as { id: string; status: DomainMediaStatus; price: number | null; photographerId: string }[];
    });
  }

  findByIdsForFulfillment(ids: string[]): Promise<MediaFulfillmentItem[]> {
    return runQuery(async () => {
      const rows = await prisma.mediaItem.findMany({
        where: { id: { in: ids } },
        select: { id: true, price: true, photographerId: true, cloudinaryPublicId: true },
      });
      return rows.map(r => ({ ...r, price: r.price! }));
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

  findPublishedBySession(sessionId: string): Promise<PublishedMedia[]> {
    return runQuery(async () => {
      const rows = await prisma.mediaItem.findMany({
        where: {
          sessionMedia: { some: { sessionId } },
          status: MEDIA_STATUS.PUBLISHED,
          deletedAt: null,
        },
        orderBy: { capturedAt: 'asc' },
        include: { spot: { select: { id: true, name: true } } },
      });
      return rows.map(mapToPublishedMedia);
    });
  }

  hasDraftsByUser(photographerId: string): Promise<boolean> {
    return runQuery(async () => {
      const count = await prisma.mediaItem.count({
        where: {
          photographerId,
          status: MEDIA_STATUS.DRAFT,
          deletedAt: null,
          sessionMedia: { none: {} },
        },
      });
      return count > 0;
    });
  }

  findDraftsByUser(photographerId: string): Promise<MediaItem[]> {
    return runQuery(async () => {
      const rows = await prisma.mediaItem.findMany({
        where: {
          photographerId,
          status: MEDIA_STATUS.DRAFT,
          deletedAt: null,
          sessionMedia: { none: {} },
        },
        orderBy: { createdAt: 'asc' },
      });
      return rows.map(mapToMediaItem);
    });
  }
}

export const mediaRepository = new MediaRepository();
