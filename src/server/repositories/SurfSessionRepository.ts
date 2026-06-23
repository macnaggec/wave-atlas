import { MediaStatus, MediaType, Prisma, SurfSessionStatus } from '@prisma/client';
import { prisma } from 'server/db';
import { runQuery } from 'server/lib/PrismaErrorMapper';
import { BadRequestError } from 'shared/errors';
import { mapToMediaItem } from './mappers';
import type { MediaItem, MediaResourceType } from 'shared/types/media';
import type { SurfSessionDraft, SurfSessionItem, SurfSessionPage } from 'shared/types/surfSession';

export type CreateSurfSessionData = {
  spotId?: string | null;
  photographerId: string;
  startsAt?: Date | null;
  endsAt?: Date | null;
  photoPrice?: number;
  videoPrice?: number;
};

export type UpdateSurfSessionDraftData = {
  spotId?: string | null;
  startsAt?: Date | null;
  endsAt?: Date | null;
  photoPrice?: number;
  videoPrice?: number;
};

export type CreateDraftMediaData = {
  sessionId: string;
  photographerId: string;
  resourceType: MediaResourceType;
  cloudinaryPublicId: string;
  thumbnailUrl: string;
  lightboxUrl: string;
  capturedAt: Date;
};

export interface ISurfSessionRepository {
  getOrCreateActiveDraft(data: CreateSurfSessionData): Promise<SurfSessionDraft>;
  createDraftMedia(data: CreateDraftMediaData): Promise<MediaItem>;
  removeDraftMedia(sessionId: string, photographerId: string, mediaId: string): Promise<void>;
  removeDraftMediaBatch(sessionId: string, photographerId: string, mediaIds: string[]): Promise<void>;
  findDraftMediaBySession(sessionId: string, photographerId: string): Promise<MediaItem[]>;
  listPublished(filter: { spotId?: string; cursor?: string; limit: number; dateFrom?: Date; dateTo?: Date }): Promise<SurfSessionPage>;
  findByPhotographer(photographerId: string): Promise<SurfSessionItem[]>;
  updateDraft(sessionId: string, photographerId: string, data: UpdateSurfSessionDraftData): Promise<{ id: string }>;
  findDraftById(sessionId: string): Promise<SurfSessionDraft | null>;
  findLatestDraftByPhotographer(photographerId: string): Promise<SurfSessionDraft | null>;
  findPublishedById(sessionId: string): Promise<SurfSessionItem | null>;
  publish(sessionId: string, photographerId: string): Promise<{ mediaIds: string[] }>;
}

const draftInclude = {
  spot: { select: { id: true, name: true, location: true } },
  _count: { select: { mediaItems: { where: { deletedAt: null } } } },
} satisfies Prisma.SurfSessionInclude;

function mapToDraft(
  row: Prisma.SurfSessionGetPayload<{ include: typeof draftInclude }>,
): SurfSessionDraft {
  return {
    id: row.id,
    spotId: row.spotId,
    photographerId: row.photographerId,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    photoPrice: row.photoPrice,
    videoPrice: row.videoPrice,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    spot: row.spot,
    mediaCount: row._count.mediaItems,
  };
}

export class SurfSessionRepository implements ISurfSessionRepository {
  getOrCreateActiveDraft(data: CreateSurfSessionData): Promise<SurfSessionDraft> {
    return runQuery(async () => {
      const existing = await this.findLatestDraftByPhotographer(data.photographerId);
      if (existing) return existing;

      let row;
      try {
        row = await prisma.surfSession.create({
          data: {
            spotId: data.spotId,
            photographerId: data.photographerId,
            startsAt: data.startsAt,
            endsAt: data.endsAt,
            photoPrice: data.photoPrice,
            videoPrice: data.videoPrice,
            status: SurfSessionStatus.DRAFT,
          },
          include: draftInclude,
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          const winner = await this.findLatestDraftByPhotographer(data.photographerId);
          if (winner) return winner;
        }
        throw error;
      }

      return mapToDraft(row);
    });
  }

  createDraftMedia(data: CreateDraftMediaData): Promise<MediaItem> {
    return runQuery(async () => {
      const row = await prisma.$transaction(async (tx) => {
        const draft = await tx.surfSession.findFirst({
          where: {
            id: data.sessionId,
            photographerId: data.photographerId,
            status: SurfSessionStatus.DRAFT,
          },
          select: { id: true },
        });
        if (!draft) throw new BadRequestError('Session is not an editable draft');

        return tx.mediaItem.create({
          data: {
            sessionId: draft.id,
            photographerId: data.photographerId,
            type: data.resourceType === 'video' ? MediaType.VIDEO : MediaType.PHOTO,
            cloudinaryPublicId: data.cloudinaryPublicId,
            thumbnailUrl: data.thumbnailUrl,
            lightboxUrl: data.lightboxUrl,
            capturedAt: data.capturedAt,
            status: MediaStatus.DRAFT,
          },
        });
      });
      return mapToMediaItem(row);
    });
  }

  removeDraftMedia(sessionId: string, photographerId: string, mediaId: string): Promise<void> {
    return runQuery(async () => {
      await prisma.$transaction(async (tx) => {
        const removed = await tx.mediaItem.deleteMany({
          where: {
            id: mediaId,
            sessionId,
            photographerId,
            status: MediaStatus.DRAFT,
            deletedAt: null,
            session: { status: SurfSessionStatus.DRAFT },
          },
        });
        if (removed.count !== 1) {
          throw new BadRequestError('Media is not part of an editable draft');
        }
      });
    });
  }

  removeDraftMediaBatch(sessionId: string, photographerId: string, mediaIds: string[]): Promise<void> {
    return runQuery(async () => {
      await prisma.$transaction(async (tx) => {
        const uniqueIds = [...new Set(mediaIds)];
        const removed = await tx.mediaItem.deleteMany({
          where: {
            id: { in: uniqueIds },
            sessionId,
            photographerId,
            status: MediaStatus.DRAFT,
            deletedAt: null,
            session: { status: SurfSessionStatus.DRAFT },
          },
        });
        if (removed.count !== uniqueIds.length) {
          throw new BadRequestError('Some media are not part of the editable draft');
        }
      });
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

  updateDraft(
    sessionId: string,
    photographerId: string,
    data: UpdateSurfSessionDraftData,
  ): Promise<{ id: string }> {
    return runQuery(async () => {
      const updated = await prisma.surfSession.updateMany({
        where: { id: sessionId, photographerId, status: SurfSessionStatus.DRAFT },
        data,
      });
      if (updated.count !== 1) {
        throw new BadRequestError('Session is not an editable draft');
      }
      return { id: sessionId };
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
          mediaItems: {
            where: { status: MediaStatus.PUBLISHED, deletedAt: null },
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

      const hasMore = rows.length > filter.limit;
      const items = (hasMore ? rows.slice(0, -1) : rows).flatMap((row) => {
        if (!row.spotId || !row.startsAt || !row.endsAt || !row.spot) return [];
        return [{
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
        }];
      });

      return {
        items,
        nextCursor: hasMore ? rows[rows.length - 2]!.id : null,
      };
    });
  }

  findByPhotographer(photographerId: string): Promise<SurfSessionItem[]> {
    return runQuery(async () => {
      const rows = await prisma.surfSession.findMany({
        where: { photographerId, status: SurfSessionStatus.PUBLISHED },
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
            select: { mediaItems: { where: { deletedAt: null } } },
          },
        },
      });

      return rows.flatMap((row) => {
        if (!row.spotId || !row.startsAt || !row.endsAt || !row.spot) return [];
        return [{
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
        }];
      });
    });
  }

  findDraftById(sessionId: string): Promise<SurfSessionDraft | null> {
    return runQuery(async () => {
      const row = await prisma.surfSession.findUnique({
        where: { id: sessionId },
        include: draftInclude,
      });

      if (!row) return null;

      return mapToDraft(row);
    });
  }

  findLatestDraftByPhotographer(photographerId: string): Promise<SurfSessionDraft | null> {
    return runQuery(async () => {
      const row = await prisma.surfSession.findFirst({
        where: { photographerId, status: SurfSessionStatus.DRAFT },
        orderBy: { updatedAt: 'desc' },
        include: draftInclude,
      });
      if (!row) return null;
      return mapToDraft(row);
    });
  }

  findPublishedById(sessionId: string): Promise<SurfSessionItem | null> {
    return runQuery(async () => {
      const row = await prisma.surfSession.findFirst({
        where: { id: sessionId, status: SurfSessionStatus.PUBLISHED },
        include: {
          spot: { select: { id: true, name: true, location: true } },
          mediaItems: {
            where: { status: MediaStatus.PUBLISHED, deletedAt: null },
            orderBy: { capturedAt: 'asc' },
            take: 1,
            select: { thumbnailUrl: true },
          },
          _count: {
            select: { mediaItems: { where: { status: MediaStatus.PUBLISHED, deletedAt: null } } },
          },
        },
      });

      if (!row || !row.spotId || !row.startsAt || !row.endsAt || !row.spot) return null;
      return {
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
      };
    });
  }

  /** Atomically publishes all DRAFT media in the session and marks it PUBLISHED. */
  publish(sessionId: string, photographerId: string): Promise<{ mediaIds: string[] }> {
    return runQuery(() =>
      prisma.$transaction(async (tx) => {
        const draft = await tx.surfSession.findFirst({
          where: { id: sessionId, photographerId, status: SurfSessionStatus.DRAFT },
          select: {
            id: true,
            spotId: true,
            startsAt: true,
            endsAt: true,
            photoPrice: true,
            videoPrice: true,
            mediaItems: {
              select: { id: true, type: true, photographerId: true, status: true, deletedAt: true },
            },
          },
        });

        if (!draft || !draft.spotId || !draft.startsAt || !draft.endsAt) {
          throw new BadRequestError('Session is not a publishable draft');
        }
        if (draft.startsAt >= draft.endsAt) {
          throw new BadRequestError('Session end time must be after its start time');
        }

        const mediaItems = draft.mediaItems;
        if (mediaItems.length === 0) {
          throw new BadRequestError('Draft session has no media');
        }
        if (mediaItems.some((item) =>
          item.photographerId !== photographerId ||
          item.status !== MediaStatus.DRAFT ||
          item.deletedAt !== null
        )) {
          throw new BadRequestError('One or more session media items are not publishable');
        }

        const photoIds = mediaItems.filter((item) => item.type === MediaType.PHOTO).map((item) => item.id);
        if (photoIds.length > 0) {
          const updatedPhotos = await tx.mediaItem.updateMany({
            where: { id: { in: photoIds }, sessionId, photographerId, status: MediaStatus.DRAFT, deletedAt: null },
            data: { spotId: draft.spotId, price: draft.photoPrice, status: MediaStatus.PUBLISHED },
          });
          if (updatedPhotos.count !== photoIds.length) {
            throw new BadRequestError('One or more session media items are not publishable');
          }
        }

        const videoIds = mediaItems.filter((item) => item.type === MediaType.VIDEO).map((item) => item.id);
        if (videoIds.length > 0) {
          const updatedVideos = await tx.mediaItem.updateMany({
            where: { id: { in: videoIds }, sessionId, photographerId, status: MediaStatus.DRAFT, deletedAt: null },
            data: { spotId: draft.spotId, price: draft.videoPrice, status: MediaStatus.PUBLISHED },
          });
          if (updatedVideos.count !== videoIds.length) {
            throw new BadRequestError('One or more session media items are not publishable');
          }
        }

        const sessionUpdate = await tx.surfSession.updateMany({
          where: { id: sessionId, photographerId, status: SurfSessionStatus.DRAFT },
          data: { status: SurfSessionStatus.PUBLISHED },
        });
        if (sessionUpdate.count !== 1) {
          throw new BadRequestError('Session is not a publishable draft');
        }

        return { mediaIds: mediaItems.map((item) => item.id) };
      }),
    );
  }
}

export const surfSessionRepository = new SurfSessionRepository();
