import { prisma } from 'server/db';
import { runQuery } from 'server/lib/PrismaErrorMapper';
import type { PublishedMedia } from 'shared/types/media';

export interface IMediaFavoriteRepository {
  add(userId: string, mediaItemId: string): Promise<void>;
  remove(userId: string, mediaItemId: string): Promise<void>;
  findIdsByUser(userId: string): Promise<string[]>;
  findByUser(userId: string): Promise<PublishedMedia[]>;
}

export class MediaFavoriteRepository implements IMediaFavoriteRepository {
  add(userId: string, mediaItemId: string): Promise<void> {
    return runQuery(async () => {
      await prisma.userFavoriteMedia.upsert({
        where: { userId_mediaItemId: { userId, mediaItemId } },
        create: { userId, mediaItemId },
        update: {},
      });
    });
  }

  remove(userId: string, mediaItemId: string): Promise<void> {
    return runQuery(async () => {
      await prisma.userFavoriteMedia.deleteMany({ where: { userId, mediaItemId } });
    });
  }

  findIdsByUser(userId: string): Promise<string[]> {
    return runQuery(async () => {
      const rows = await prisma.userFavoriteMedia.findMany({
        where: { userId, mediaItem: { status: 'PUBLISHED', deletedAt: null } },
        orderBy: { createdAt: 'desc' },
        select: { mediaItemId: true },
      });
      return rows.map((row) => row.mediaItemId);
    });
  }

  findByUser(userId: string): Promise<PublishedMedia[]> {
    return runQuery(async () => {
      const rows = await prisma.userFavoriteMedia.findMany({
        where: { userId, mediaItem: { status: 'PUBLISHED', deletedAt: null } },
        orderBy: { createdAt: 'desc' },
        include: { mediaItem: { include: { spot: { select: { id: true, name: true } } } } },
      });
      return rows.map(({ mediaItem }) => ({
        id: mediaItem.id,
        type: mediaItem.type,
        lightboxUrl: mediaItem.lightboxUrl,
        thumbnailUrl: mediaItem.thumbnailUrl,
        price: mediaItem.price!,
        capturedAt: mediaItem.capturedAt,
        spotId: mediaItem.spotId!,
        photographerId: mediaItem.photographerId,
        spot: mediaItem.spot,
      }));
    });
  }
}

export const mediaFavoriteRepository = new MediaFavoriteRepository();
