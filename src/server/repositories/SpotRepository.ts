import { Spot as PrismaSpot } from '@prisma/client';
import { prisma } from 'server/db';
import { haversineDistance, EARTH_RADIUS_M } from 'shared/lib/geoUtils';
import { SPOT_STATUS, SpotStatus } from 'entities/Spot/constants';
import type { Spot } from 'entities/Spot/types';

export interface SpotSearchFilter {
  search?: string;
}

interface SpotBoundingBox {
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

export async function findSpotList(filter: SpotSearchFilter): Promise<Spot[]> {
  const rows = await prisma.spot.findMany({
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
  return rows.map(mapPrismaToSpot);
}

async function findSpotsInBoundingBox(bbox: SpotBoundingBox): Promise<PrismaSpot[]> {
  return prisma.spot.findMany({
    where: {
      lat: { gte: bbox.latMin, lte: bbox.latMax },
      lng: { gte: bbox.lngMin, lte: bbox.lngMax },
    },
  });
}

export async function findSpotsNearby(
  lat: number,
  lng: number,
  radiusM: number,
): Promise<Spot[]> {
  const latDelta = (radiusM / EARTH_RADIUS_M) * (180 / Math.PI);
  const lngDelta = latDelta / Math.cos((lat * Math.PI) / 180);

  const candidates = await findSpotsInBoundingBox({
    latMin: lat - latDelta,
    latMax: lat + latDelta,
    lngMin: lng - lngDelta,
    lngMax: lng + lngDelta,
  });

  return candidates
    .filter((s) => {
      const dist = haversineDistance(lat, lng, Number(s.lat), Number(s.lng));
      return dist <= radiusM;
    })
    .map(mapPrismaToSpot);
}

export function mapPrismaToSpot(spot: PrismaSpot): Spot {
  return {
    id: spot.id,
    name: spot.name,
    location: spot.location,
    coords: [Number(spot.lat), Number(spot.lng)] as [number, number],
    status: (spot.status as SpotStatus) || SPOT_STATUS.VERIFIED,
  };
}

export async function findSpotById(id: string): Promise<PrismaSpot | null> {
  return prisma.spot.findUnique({ where: { id } });
}

export async function createSpot(data: SpotCreateInput): Promise<Spot> {
  const spot = await prisma.spot.create({ data });
  return mapPrismaToSpot(spot);
}

export async function pushSpotAlias(id: string, alias: string): Promise<void> {
  await prisma.spot.update({
    where: { id },
    data: { aliases: { push: alias } },
  });
}

export async function findSpotDetails(id: string) {
  const spot = await prisma.spot.findUnique({
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

  if (!spot) return null;

  return {
    ...mapPrismaToSpot(spot),
    lat: spot.lat ? Number(spot.lat) : null,
    lng: spot.lng ? Number(spot.lng) : null,
    mediaItems: spot.mediaItems,
  };
}

export async function findSpotCard(id: string) {
  const spot = await prisma.spot.findUnique({
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

  if (!spot) return null;

  return {
    id: spot.id,
    name: spot.name,
    location: spot.location,
    totalMedia: spot._count.mediaItems,
    media: spot.mediaItems.map((m) => ({ id: m.id, url: m.lightboxUrl, type: m.type })),
  };
}
