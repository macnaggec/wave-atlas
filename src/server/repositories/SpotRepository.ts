import { MediaItem as PrismaMediaItem, Spot as PrismaSpot } from '@prisma/client';
import type { MediaType } from 'entities/Media/types';
import { MEDIA_STATUS } from 'entities/Media/constants';
import type { MediaItem, SpotMediaItem } from 'entities/Media/types';
import type { Spot } from 'entities/Spot/types';
import { SPOT_STATUS } from 'entities/Spot/constants';
import type { SpotStatus } from 'entities/Spot/constants';
import { prisma } from 'server/db';
import { haversineDistance, EARTH_RADIUS_M } from 'shared/lib/geoUtils';
import { mapToMediaItem } from './MediaRepository';
import { runQuery } from './BaseRepository';

function mapToSpot(spot: PrismaSpot): Spot {
  return {
    id: spot.id,
    name: spot.name,
    location: spot.location,
    coords: [Number(spot.lat), Number(spot.lng)] as [number, number],
    status: (spot.status as SpotStatus) || SPOT_STATUS.VERIFIED,
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

export interface SpotSearchFilter {
  search?: string;
}

export interface SpotCreateInput {
  name: string;
  location: string;
  lat: number;
  lng: number;
  status: string;
  creatorId: string;
}

/** Spot with its `aliases` array — needed for the addAlias route. */
export type SpotRow = Spot & { aliases: string[] };

export type SpotDetails = Spot & {
  lat: number | null;
  lng: number | null;
  mediaItems: SpotMediaItem[];
};

export type SpotCard = {
  id: string;
  name: string;
  location: string;
  totalMedia: number;
  media: { id: string; url: string; type: MediaType }[];
};

export interface ISpotRepository {
  findSpotList(filter: SpotSearchFilter): Promise<Spot[]>;
  findSpotsNearby(lat: number, lng: number, radiusM: number): Promise<Spot[]>;
  findSpotById(id: string): Promise<SpotRow | null>;
  createSpot(data: SpotCreateInput): Promise<Spot>;
  pushSpotAlias(id: string, alias: string): Promise<void>;
  findSpotDetails(id: string): Promise<SpotDetails | null>;
  findSpotCard(id: string): Promise<SpotCard | null>;
  findDraftsBySpot(spotId: string, photographerId: string): Promise<MediaItem[]>;
}

export class SpotRepository implements ISpotRepository {
  findSpotList(filter: SpotSearchFilter): Promise<Spot[]> {
    return runQuery(async () => {
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
      return rows.map(mapToSpot);
    });
  }

  async findSpotsNearby(lat: number, lng: number, radiusM: number): Promise<Spot[]> {
    const latDelta = (radiusM / EARTH_RADIUS_M) * (180 / Math.PI);
    const lngDelta = latDelta / Math.cos((lat * Math.PI) / 180);

    const candidates = await runQuery(() =>
      prisma.spot.findMany({
        where: {
          lat: { gte: lat - latDelta, lte: lat + latDelta },
          lng: { gte: lng - lngDelta, lte: lng + lngDelta },
        },
      })
    );

    return candidates
      .filter((s) => {
        const dist = haversineDistance(lat, lng, Number(s.lat), Number(s.lng));
        return dist <= radiusM;
      })
      .map(mapToSpot);
  }

  findSpotById(id: string): Promise<SpotRow | null> {
    return runQuery(async () => {
      const spot = await prisma.spot.findUnique({ where: { id } });
      if (!spot) return null;
      return { ...mapToSpot(spot), aliases: spot.aliases };
    });
  }

  createSpot(data: SpotCreateInput): Promise<Spot> {
    return runQuery(async () => {
      const spot = await prisma.spot.create({ data });
      return mapToSpot(spot);
    });
  }

  pushSpotAlias(id: string, alias: string): Promise<void> {
    return runQuery(async () => {
      await prisma.spot.update({
        where: { id },
        data: { aliases: { push: alias } },
      });
    });
  }

  findSpotDetails(id: string): Promise<SpotDetails | null> {
    return runQuery(async () => {
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
        ...mapToSpot(spot),
        lat: spot.lat ? Number(spot.lat) : null,
        lng: spot.lng ? Number(spot.lng) : null,
        mediaItems: spot.mediaItems.map(mapToSpotMediaItem),
      };
    });
  }

  findSpotCard(id: string): Promise<SpotCard | null> {
    return runQuery(async () => {
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
}

export const spotRepository = new SpotRepository();

