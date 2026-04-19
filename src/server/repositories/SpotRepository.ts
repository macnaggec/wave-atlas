import { Spot as PrismaSpot } from '@prisma/client';
import { prisma } from 'server/db';

export interface SpotSearchFilter {
  search?: string;
}

export interface SpotBoundingBox {
  latMin: number;
  latMax: number;
  lngMin: number;
  lngMax: number;
}

export interface SpotCreateInput {
  name: string;
  location: string;
  lat: number;
  lng: number;
  status: string;
  creatorId: string;
}

export async function findSpotList(filter: SpotSearchFilter): Promise<PrismaSpot[]> {
  return prisma.spot.findMany({
    where: {
      AND: [
        { lat: { not: null } },
        { lng: { not: null } },
        filter.search
          ? {
            OR: [
              { name: { contains: filter.search, mode: 'insensitive' } },
              { location: { contains: filter.search, mode: 'insensitive' } },
              { aliases: { hasSome: [filter.search] } },
            ],
          }
          : {},
      ],
    },
    orderBy: { name: 'asc' },
  });
}

export async function findSpotsInBoundingBox(bbox: SpotBoundingBox): Promise<PrismaSpot[]> {
  return prisma.spot.findMany({
    where: {
      lat: { gte: bbox.latMin, lte: bbox.latMax },
      lng: { gte: bbox.lngMin, lte: bbox.lngMax },
    },
  });
}

export async function findSpotById(id: string): Promise<PrismaSpot | null> {
  return prisma.spot.findUnique({ where: { id } });
}

export async function createSpot(data: SpotCreateInput): Promise<PrismaSpot> {
  return prisma.spot.create({ data });
}

export async function pushSpotAlias(id: string, alias: string): Promise<void> {
  await prisma.spot.update({
    where: { id },
    data: { aliases: { push: alias } },
  });
}

export async function findSpotDetails(id: string) {
  return prisma.spot.findUnique({
    where: { id },
    include: {
      mediaItems: {
        where: { status: 'PUBLISHED', deletedAt: null },
        orderBy: { capturedAt: 'desc' },
        include: {
          photographer: { select: { id: true, name: true } },
        },
      },
    },
  });
}

export async function findSpotCard(id: string) {
  return prisma.spot.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      location: true,
      _count: {
        select: { mediaItems: { where: { status: 'PUBLISHED', deletedAt: null } } },
      },
      mediaItems: {
        take: 5,
        where: { status: 'PUBLISHED', deletedAt: null },
        orderBy: { createdAt: 'desc' },
        select: { id: true, lightboxUrl: true, type: true },
      },
    },
  });
}
