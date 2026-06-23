import { MediaItem as PrismaMediaItem } from '@prisma/client';
import { prisma } from 'server/db';
import { runQuery } from 'server/lib/PrismaErrorMapper';
import { MEDIA_STATUS } from 'shared/constants/media';
import type { MediaItem, PublishedMedia, MediaStatus as DomainMediaStatus, SpotMediaItem } from 'shared/types/media';
import { mapToMediaItem } from './mappers';

export type SpotMediaPage = {
  items: SpotMediaItem[];
  nextCursor: string | null;
};

function mapToPublishedMedia(
  row: PrismaMediaItem & { spot: { id: string; name: string } | null },
): PublishedMedia {
  return {
    id: row.id,
    type: row.type,
    lightboxUrl: row.lightboxUrl,
    thumbnailUrl: row.thumbnailUrl,
    price: row.price!,
    capturedAt: row.capturedAt,
    spotId: row.spotId!,
    photographerId: row.photographerId,
    spot: row.spot,
  };
}

function mapToSpotMediaItem(
  row: PrismaMediaItem & { photographer: { id: string; name: string | null } | null },
): SpotMediaItem {
  return {
    ...mapToMediaItem(row),
    photographer: row.photographer,
  };
}

export type UpdateMediaData = { price?: number; status?: DomainMediaStatus; capturedAt?: Date; spotId?: string };

export type MediaFulfillmentItem = {
  id: string;
  price: number;
  photographerId: string;
  cloudinaryPublicId: string;
};

export interface IMediaRepository {
  findById(id: string): Promise<MediaItem | null>;
  findByCloudinaryPublicId(publicId: string): Promise<{ id: string; photographerId: string } | null>;
  updateMedia(id: string, data: UpdateMediaData): Promise<MediaItem>;
  updateManyMedia(ids: string[], data: UpdateMediaData): Promise<void>;
  softDelete(id: string): Promise<MediaItem>;
  findByIds(ids: string[]): Promise<{ id: string; sessionId: string; status: DomainMediaStatus; price: number | null; photographerId: string; cloudinaryPublicId: string; type: string }[]>;
  findByIdsForFulfillment(ids: string[]): Promise<MediaFulfillmentItem[]>;
  findPublishedByPhotographer(photographerId: string): Promise<PublishedMedia[]>;
  findPublishedBySession(sessionId: string): Promise<PublishedMedia[]>;
  hasDraftsByUser(photographerId: string): Promise<boolean>;
  findDraftsByUser(photographerId: string): Promise<MediaItem[]>;
  findDraftsBySpot(spotId: string, photographerId: string): Promise<MediaItem[]>;
  findPublishedBySpot(spotId: string, cursor: string | undefined, limit: number, sortOrder?: 'asc' | 'desc'): Promise<SpotMediaPage>;
}

export class MediaRepository implements IMediaRepository {
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

  findByIds(ids: string[]): Promise<{ id: string; sessionId: string; status: DomainMediaStatus; price: number | null; photographerId: string; cloudinaryPublicId: string; type: string }[]> {
    return runQuery(async () => {
      const rows = await prisma.mediaItem.findMany({
        where: { id: { in: ids } },
        select: { id: true, sessionId: true, status: true, price: true, photographerId: true, cloudinaryPublicId: true, type: true },
      });
      return rows as { id: string; sessionId: string; status: DomainMediaStatus; price: number | null; photographerId: string; cloudinaryPublicId: string; type: string }[];
    });
  }

  findByIdsForFulfillment(ids: string[]): Promise<MediaFulfillmentItem[]> {
    return runQuery(async () => {
      const rows = await prisma.mediaItem.findMany({
        where: {
          id: { in: ids },
          status: MEDIA_STATUS.PUBLISHED,
          deletedAt: null,
          price: { not: null },
        },
        select: { id: true, price: true, photographerId: true, cloudinaryPublicId: true },
      });
      return rows.map(r => {
        if (r.price === null) throw new Error('Invariant: null price after price filter');
        return { ...r, price: r.price };
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

  findPublishedBySession(sessionId: string): Promise<PublishedMedia[]> {
    return runQuery(async () => {
      const rows = await prisma.mediaItem.findMany({
        where: {
          sessionId,
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
        },
        orderBy: { createdAt: 'asc' },
      });
      return rows.map(mapToMediaItem);
    });
  }

  findDraftsBySpot(spotId: string, photographerId: string): Promise<MediaItem[]> {
    return runQuery(async () => {
      const rows = await prisma.mediaItem.findMany({
        where: { spotId, photographerId, status: MEDIA_STATUS.DRAFT, deletedAt: null },
        orderBy: { createdAt: 'desc' },
      });
      return rows.map(mapToMediaItem);
    });
  }

  findPublishedBySpot(
    spotId: string,
    cursor: string | undefined,
    limit: number,
    sortOrder: 'asc' | 'desc' = 'desc',
  ): Promise<SpotMediaPage> {
    return runQuery(async () => {
      const rows = await prisma.mediaItem.findMany({
        where: { spotId, status: MEDIA_STATUS.PUBLISHED, deletedAt: null },
        orderBy: { capturedAt: sortOrder },
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        include: { photographer: { select: { id: true, name: true } } },
      });

      const hasMore = rows.length > limit;
      const items = hasMore ? rows.slice(0, limit) : rows;
      const nextCursor = hasMore ? items[items.length - 1]!.id : null;

      return { items: items.map(mapToSpotMediaItem), nextCursor };
    });
  }
}

export const mediaRepository = new MediaRepository();
