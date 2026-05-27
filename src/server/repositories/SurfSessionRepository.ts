import { MediaStatus } from '@prisma/client';
import { prisma } from 'server/db';
import { runQuery } from 'shared/errors/PrismaErrorMapper';
import { mapToMediaItem } from './mappers';
import type { MediaItem } from 'entities/Media/types';

export type CreateSurfSessionData = {
  spotId: string;
  photographerId: string;
  startsAt: Date;
  endsAt: Date;
};

export type SurfSessionItem = {
  id: string;
  spotId: string;
  photographerId: string;
  startsAt: Date;
  endsAt: Date;
  status: string;
  createdAt: Date;
  spot: { id: string; name: string; location: string };
  thumbnailUrl: string | null;
  mediaCount: number;
};

export type SurfSessionPage = {
  items: SurfSessionItem[];
  nextCursor: string | null;
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
          status: MediaStatus.DRAFT,
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
          sessionId,
          photographerId,
          status: MediaStatus.DRAFT,
          deletedAt: null,
        },
        orderBy: { createdAt: 'desc' },
      });
      return rows.map(mapToMediaItem);
    });
  }

  listPublished(filter: { spotId?: string; cursor?: string; limit: number }): Promise<SurfSessionPage> {
    return runQuery(async () => {
      const rows = await prisma.surfSession.findMany({
        where: {
          status: MediaStatus.PUBLISHED,
          ...(filter.spotId ? { spotId: filter.spotId } : {}),
        },
        take: filter.limit + 1,
        ...(filter.cursor ? { cursor: { id: filter.cursor }, skip: 1 } : {}),
        orderBy: { createdAt: 'desc' },
        include: {
          spot: { select: { id: true, name: true, location: true } },
          mediaItems: {
            where: { status: MediaStatus.PUBLISHED, deletedAt: null },
            orderBy: { capturedAt: 'asc' },
            take: 1,
            select: { thumbnailUrl: true, cloudinaryPublicId: true },
          },
          _count: { select: { mediaItems: { where: { status: MediaStatus.PUBLISHED, deletedAt: null } } } },
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
        thumbnailUrl: row.mediaItems[0]?.thumbnailUrl ?? null,
        mediaCount: row._count.mediaItems,
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
        where: { photographerId, status: { not: MediaStatus.DELETED } },
        orderBy: { createdAt: 'desc' },
        include: {
          spot: { select: { id: true, name: true, location: true } },
          mediaItems: {
            where: { deletedAt: null },
            orderBy: { capturedAt: 'asc' },
            take: 1,
            select: { thumbnailUrl: true, cloudinaryPublicId: true },
          },
          _count: {
            select: {
              mediaItems: { where: { status: MediaStatus.PUBLISHED, deletedAt: null } },
            },
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
        thumbnailUrl: row.mediaItems[0]?.thumbnailUrl ?? null,
        mediaCount: row._count.mediaItems,
      }));
    });
  }

  /** Publishes all DRAFT media in the session and sets session status to PUBLISHED. */
  publish(sessionId: string, photographerId: string): Promise<{ mediaIds: string[] }> {
    return runQuery(async () => {
      const updated = await prisma.mediaItem.updateMany({
        where: {
          sessionId,
          photographerId,
          status: MediaStatus.DRAFT,
          deletedAt: null,
        },
        data: { status: MediaStatus.PUBLISHED },
      });

      await prisma.surfSession.update({
        where: { id: sessionId },
        data: { status: MediaStatus.PUBLISHED },
      });

      // Return the IDs that were published
      const published = await prisma.mediaItem.findMany({
        where: { sessionId, photographerId, status: MediaStatus.PUBLISHED, deletedAt: null },
        select: { id: true },
      });

      return { mediaIds: published.map((m) => m.id), count: updated.count };
    });
  }
}

export const surfSessionRepository = new SurfSessionRepository();
