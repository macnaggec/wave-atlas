import { MediaStatus, MediaType, SurfSessionStatus } from '@prisma/client';
import { prisma } from 'server/db';
import { runQuery } from 'shared/errors/PrismaErrorMapper';
import { mapToMediaItem } from './mappers';
import type { MediaItem } from 'entities/Media';
import type { SurfSessionItem, SurfSessionPage } from 'entities/SurfSession';

export type CreateSurfSessionData = {
  spotId: string;
  photographerId: string;
  startsAt: Date;
  endsAt: Date;
};

export type CreateAndPublishData = CreateSurfSessionData & {
  /** IDs of the specific unlinked DRAFT MediaItems to attach and publish. */
  mediaIds: string[];
  /** Price in cents applied to all photo items. */
  photoPrice: number;
  /** Price in cents applied to all video items. */
  videoPrice: number;
};


export class SurfSessionRepository {
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

        // Fetch types for type-specific price assignment
        const items = await tx.mediaItem.findMany({
          where: {
            id: { in: data.mediaIds },
            photographerId: data.photographerId,
            status: MediaStatus.DRAFT,
            deletedAt: null,
          },
          select: { id: true, type: true },
        });

        // Create SessionMedia join rows
        await tx.sessionMedia.createMany({
          data: items.map((item) => ({ sessionId: session.id, mediaId: item.id })),
        });

        // Publish photos
        const photoIds = items.filter((i) => i.type === MediaType.PHOTO).map((i) => i.id);
        if (photoIds.length > 0) {
          await tx.mediaItem.updateMany({
            where: { id: { in: photoIds } },
            data: { spotId: data.spotId, price: data.photoPrice, status: MediaStatus.PUBLISHED },
          });
        }

        // Publish videos
        const videoIds = items.filter((i) => i.type === MediaType.VIDEO).map((i) => i.id);
        if (videoIds.length > 0) {
          await tx.mediaItem.updateMany({
            where: { id: { in: videoIds } },
            data: { spotId: data.spotId, price: data.videoPrice, status: MediaStatus.PUBLISHED },
          });
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
        await tx.mediaItem.updateMany({
          where: {
            sessionMedia: { some: { sessionId } },
            photographerId,
            status: MediaStatus.DRAFT,
            deletedAt: null,
          },
          data: { status: MediaStatus.PUBLISHED },
        });

        await tx.surfSession.update({
          where: { id: sessionId },
          data: { status: SurfSessionStatus.PUBLISHED },
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
