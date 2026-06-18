import { MediaStatus, MediaType, SurfSessionStatus } from '@prisma/client';
import { prisma } from 'server/db';
import { runQuery } from 'server/lib/PrismaErrorMapper';
import { BadRequestError } from 'shared/errors';
import { mapToMediaItem } from './mappers';
import type { MediaItem } from 'shared/types/media';
import type { SurfSessionItem, SurfSessionPage } from 'shared/types/surfSession';

export type CreateSurfSessionData = {
  spotId: string;
  photographerId: string;
  startsAt: Date;
  endsAt: Date;
};

export type PublishableDraftMedia = {
  id: string;
  type: MediaType;
};

export type CreateAndPublishData = CreateSurfSessionData & {
  /** Media already checked by the service as publishable drafts. */
  mediaItems: PublishableDraftMedia[];
  /** Price in cents applied to all photo items. */
  photoPrice: number;
  /** Price in cents applied to all video items. */
  videoPrice: number;
};

export interface ISurfSessionRepository {
  create(data: CreateSurfSessionData): Promise<{ id: string; spotId: string; startsAt: Date; endsAt: Date }>;
  findDraftMediaBySession(sessionId: string, photographerId: string): Promise<MediaItem[]>;
  findPublishableDraftMedia(photographerId: string, mediaIds: string[]): Promise<PublishableDraftMedia[]>;
  listPublished(filter: { spotId?: string; cursor?: string; limit: number; dateFrom?: Date; dateTo?: Date }): Promise<SurfSessionPage>;
  findByPhotographer(photographerId: string): Promise<SurfSessionItem[]>;
  createAndPublish(data: CreateAndPublishData): Promise<{ id: string }>;
  findById(sessionId: string): Promise<SurfSessionItem | null>;
  publish(sessionId: string, photographerId: string): Promise<{ mediaIds: string[] }>;
}

export class SurfSessionRepository implements ISurfSessionRepository {
  create(data: CreateSurfSessionData): Promise<{ id: string; spotId: string; startsAt: Date; endsAt: Date }> {
    return runQuery(async () => {
      const row = await prisma.surfSession.create({
        data: {
          spotId: data.spotId,
          photographerId: data.photographerId,
          startsAt: data.startsAt,
          endsAt: data.endsAt,
          status: SurfSessionStatus.DRAFT,
        },
        select: { id: true, spotId: true, startsAt: true, endsAt: true },
      });
      return row;
    });
  }

  findDraftMediaBySession(sessionId: string, photographerId: string): Promise<MediaItem[]> {
    return runQuery(async () => {
      const rows = await prisma.mediaItem.findMany({
        where: {
          sessionMedia: { some: { sessionId } },
          photographerId,
          status: MediaStatus.DRAFT,
          deletedAt: null,
        },
        orderBy: { createdAt: 'desc' },
      });
      return rows.map(mapToMediaItem);
    });
  }

  findPublishableDraftMedia(photographerId: string, mediaIds: string[]): Promise<PublishableDraftMedia[]> {
    return runQuery(() =>
      prisma.mediaItem.findMany({
        where: {
          id: { in: mediaIds },
          photographerId,
          status: MediaStatus.DRAFT,
          deletedAt: null,
        },
        select: { id: true, type: true },
      }),
    );
  }

  listPublished(filter: { spotId?: string; cursor?: string; limit: number; dateFrom?: Date; dateTo?: Date }): Promise<SurfSessionPage> {
    return runQuery(async () => {
      const rows = await prisma.surfSession.findMany({
        where: {
          status: SurfSessionStatus.PUBLISHED,
          ...(filter.spotId ? { spotId: filter.spotId } : {}),
          ...(filter.dateFrom || filter.dateTo ? {
            startsAt: {
              ...(filter.dateFrom ? { gte: filter.dateFrom } : {}),
              ...(filter.dateTo ? { lt: filter.dateTo } : {}),
            },
          } : {}),
        },
        take: filter.limit + 1,
        ...(filter.cursor ? { cursor: { id: filter.cursor }, skip: 1 } : {}),
        orderBy: { createdAt: 'desc' },
        include: {
          spot: { select: { id: true, name: true, location: true } },
          sessionMedia: {
            where: { media: { status: MediaStatus.PUBLISHED, deletedAt: null } },
            orderBy: { media: { capturedAt: 'asc' } },
            take: 1,
            include: { media: { select: { thumbnailUrl: true, cloudinaryPublicId: true } } },
          },
          _count: {
            select: {
              sessionMedia: { where: { media: { status: MediaStatus.PUBLISHED, deletedAt: null } } },
            },
          },
        },
      });

      const hasMore = rows.length > filter.limit;
      const items = (hasMore ? rows.slice(0, -1) : rows).map((row) => ({
        id: row.id,
        spotId: row.spotId,
        photographerId: row.photographerId,
        startsAt: row.startsAt,
        endsAt: row.endsAt,
        status: row.status,
        createdAt: row.createdAt,
        spot: row.spot,
        thumbnailUrl: row.sessionMedia[0]?.media.thumbnailUrl ?? null,
        mediaCount: row._count.sessionMedia,
      }));

      return {
        items,
        nextCursor: hasMore ? rows[rows.length - 2]!.id : null,
      };
    });
  }

  findByPhotographer(photographerId: string): Promise<SurfSessionItem[]> {
    return runQuery(async () => {
      const rows = await prisma.surfSession.findMany({
        where: { photographerId, status: { not: SurfSessionStatus.DELETED } },
        orderBy: { createdAt: 'desc' },
        include: {
          spot: { select: { id: true, name: true, location: true } },
          sessionMedia: {
            where: { media: { deletedAt: null } },
            orderBy: { media: { capturedAt: 'asc' } },
            take: 1,
            include: { media: { select: { thumbnailUrl: true, cloudinaryPublicId: true } } },
          },
          _count: {
            select: { sessionMedia: { where: { media: { deletedAt: null } } } },
          },
        },
      });

      return rows.map((row) => ({
        id: row.id,
        spotId: row.spotId,
        photographerId: row.photographerId,
        startsAt: row.startsAt,
        endsAt: row.endsAt,
        status: row.status,
        createdAt: row.createdAt,
        spot: row.spot,
        thumbnailUrl: row.sessionMedia[0]?.media.thumbnailUrl ?? null,
        mediaCount: row._count.sessionMedia,
      }));
    });
  }

  /**
   * Creates a session and atomically:
   * - Links draft MediaItems via SessionMedia join rows
   * - Sets spotId and price (by type) on each item
   * - Publishes items and session
   */
  createAndPublish(data: CreateAndPublishData): Promise<{ id: string }> {
    return runQuery(() =>
      prisma.$transaction(async (tx) => {
        const session = await tx.surfSession.create({
          data: {
            spotId: data.spotId,
            photographerId: data.photographerId,
            startsAt: data.startsAt,
            endsAt: data.endsAt,
            status: SurfSessionStatus.PUBLISHED,
          },
          select: { id: true },
        });

        // Create SessionMedia join rows
        await tx.sessionMedia.createMany({
          data: data.mediaItems.map((item) => ({ sessionId: session.id, mediaId: item.id })),
        });

        // Publish photos
        const photoIds = data.mediaItems.filter((i) => i.type === MediaType.PHOTO).map((i) => i.id);
        if (photoIds.length > 0) {
          const photoUpdate = await tx.mediaItem.updateMany({
            where: {
              id: { in: photoIds },
              photographerId: data.photographerId,
              status: MediaStatus.DRAFT,
              deletedAt: null,
            },
            data: { spotId: data.spotId, price: data.photoPrice, status: MediaStatus.PUBLISHED },
          });
          if (photoUpdate.count !== photoIds.length) {
            throw new BadRequestError('One or more media items not found or already published');
          }
        }

        // Publish videos
        const videoIds = data.mediaItems.filter((i) => i.type === MediaType.VIDEO).map((i) => i.id);
        if (videoIds.length > 0) {
          const videoUpdate = await tx.mediaItem.updateMany({
            where: {
              id: { in: videoIds },
              photographerId: data.photographerId,
              status: MediaStatus.DRAFT,
              deletedAt: null,
            },
            data: { spotId: data.spotId, price: data.videoPrice, status: MediaStatus.PUBLISHED },
          });
          if (videoUpdate.count !== videoIds.length) {
            throw new BadRequestError('One or more media items not found or already published');
          }
        }

        return { id: session.id };
      }),
    );
  }

  findById(sessionId: string): Promise<SurfSessionItem | null> {
    return runQuery(async () => {
      const row = await prisma.surfSession.findUnique({
        where: { id: sessionId },
        include: {
          spot: { select: { id: true, name: true, location: true } },
          sessionMedia: {
            where: { media: { status: MediaStatus.PUBLISHED, deletedAt: null } },
            orderBy: { media: { capturedAt: 'asc' } },
            take: 1,
            include: { media: { select: { thumbnailUrl: true, cloudinaryPublicId: true } } },
          },
          _count: {
            select: {
              sessionMedia: { where: { media: { status: MediaStatus.PUBLISHED, deletedAt: null } } },
            },
          },
        },
      });

      if (!row) return null;

      return {
        id: row.id,
        spotId: row.spotId,
        photographerId: row.photographerId,
        startsAt: row.startsAt,
        endsAt: row.endsAt,
        status: row.status,
        createdAt: row.createdAt,
        spot: row.spot,
        thumbnailUrl: row.sessionMedia[0]?.media.thumbnailUrl ?? null,
        mediaCount: row._count.sessionMedia,
      };
    });
  }

  /** Atomically publishes all DRAFT media in the session and marks it PUBLISHED. */
  publish(sessionId: string, photographerId: string): Promise<{ mediaIds: string[] }> {
    return runQuery(() =>
      prisma.$transaction(async (tx) => {
        const sessionUpdate = await tx.surfSession.updateMany({
          where: {
            id: sessionId,
            photographerId,
            status: SurfSessionStatus.DRAFT,
          },
          data: { status: SurfSessionStatus.PUBLISHED },
        });

        if (sessionUpdate.count !== 1) {
          throw new BadRequestError('Session is not a publishable draft');
        }

        await tx.mediaItem.updateMany({
          where: {
            sessionMedia: { some: { sessionId } },
            photographerId,
            status: MediaStatus.DRAFT,
            deletedAt: null,
          },
          data: { status: MediaStatus.PUBLISHED },
        });

        const published = await tx.mediaItem.findMany({
          where: {
            sessionMedia: { some: { sessionId } },
            photographerId,
            status: MediaStatus.PUBLISHED,
            deletedAt: null,
          },
          select: { id: true },
        });

        return { mediaIds: published.map((m) => m.id) };
      }),
    );
  }
}

export const surfSessionRepository = new SurfSessionRepository();
