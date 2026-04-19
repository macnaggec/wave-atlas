import { MediaItem as PrismaMediaItem, MediaStatus, MediaType, Prisma } from '@prisma/client';
import { MEDIA_RESOURCE_TYPE, MEDIA_STATUS } from 'entities/Media/constants';
import { MediaItem } from 'entities/Media/types';
import { prisma } from 'server/db';

export async function createMedia(data: {
  spotId: string;
  photographerId: string;
  type: MediaType;
  cloudinaryPublicId: string;
  thumbnailUrl: string;
  lightboxUrl: string;
  capturedAt: Date;
  price: number;
  status: MediaStatus;
}): Promise<PrismaMediaItem> {
  return prisma.mediaItem.create({ data });
}

export async function findMediaById(id: string): Promise<PrismaMediaItem | null> {
  return prisma.mediaItem.findUnique({ where: { id } });
}

export async function updateMedia(
  id: string,
  data: { price?: number; status?: MediaStatus; capturedAt?: Date }
): Promise<PrismaMediaItem> {
  return prisma.mediaItem.update({ where: { id }, data });
}

export async function softDeleteMedia(id: string): Promise<PrismaMediaItem> {
  return prisma.mediaItem.update({
    where: { id },
    data: { status: MEDIA_STATUS.DELETED, deletedAt: new Date() },
  });
}

export async function hardDeleteMedia(id: string): Promise<void> {
  await prisma.mediaItem.delete({ where: { id } });
}

export interface IMediaRepository {
  findById(id: string): Promise<PrismaMediaItem | null>;
}

export const mediaRepository: IMediaRepository = {
  findById: findMediaById,
};

export async function findMediaByIds(
  ids: string[],
): Promise<{
  id: string;
  status: string;
  price: Prisma.Decimal;
  photographerId: string
}[]> {
  return prisma.mediaItem.findMany({
    where: { id: { in: ids } },
    select: { id: true, status: true, price: true, photographerId: true },
  });
}

export async function findPublishedByPhotographer(photographerId: string) {
  return prisma.mediaItem.findMany({
    where: { photographerId, status: MEDIA_STATUS.PUBLISHED, deletedAt: null },
    orderBy: { capturedAt: 'desc' },
    include: { spot: { select: { id: true, name: true } } },
  });
}

export async function countDraftsBySpot(
  photographerId: string,
): Promise<{ spotId: string; spotName: string; count: number }[]> {
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
}

export function mapPrismaToMediaItem(prismaMedia: PrismaMediaItem): MediaItem {
  return {
    id: prismaMedia.id,
    photographerId: prismaMedia.photographerId,
    spotId: prismaMedia.spotId,
    capturedAt: prismaMedia.capturedAt,
    price: Math.round(Number(prismaMedia.price) * 100),
    lightboxUrl: prismaMedia.lightboxUrl,
    thumbnailUrl: prismaMedia.thumbnailUrl,
    cloudinaryPublicId: prismaMedia.cloudinaryPublicId,
    status: prismaMedia.status,
    createdAt: prismaMedia.createdAt,
    resource: {
      resource_type: prismaMedia.type === MediaType.VIDEO
        ? MEDIA_RESOURCE_TYPE.VIDEO
        : MEDIA_RESOURCE_TYPE.IMAGE,
      url: prismaMedia.lightboxUrl,
      asset_id: prismaMedia.id,
    },
  };
}
