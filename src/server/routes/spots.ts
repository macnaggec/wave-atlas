import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from 'server/trpc';
import { prisma } from 'server/db';
import {
  findSpotList,
  findSpotsInBoundingBox,
  findSpotById,
  createSpot,
  pushSpotAlias,
  findSpotDetails,
  findSpotCard,
} from 'server/repositories/SpotRepository';
import { SPOT_STATUS, SpotStatus } from 'entities/Spot/constants';
import type { Spot } from 'entities/Spot/types';
import { mapPrismaToMediaItem } from 'server/repositories/MediaRepository';
import { haversineDistance, EARTH_RADIUS_M } from 'shared/lib/geoUtils';
import { spotNameSchema, spotLocationSchema, spotAliasSchema } from 'shared/validation/spotSchemas';
import { NotFoundError } from 'shared/errors';

export const spotsRouter = router({
  list: publicProcedure
    .input(z.string().optional())
    .query(async ({ input: search }): Promise<Spot[]> => {
      const spots = await findSpotList({ search });

      return spots.map((spot) => ({
        id: spot.id,
        name: spot.name,
        location: spot.location,
        coords: [Number(spot.lat), Number(spot.lng)] as [number, number],
        status: (spot.status as SpotStatus) || SPOT_STATUS.VERIFIED,
      }));
    }),

  /** Returns spots within 300 m of the given coordinates. Used for proximity deduplication. */
  nearby: publicProcedure
    .input(z.object({ lat: z.number(), lng: z.number() }))
    .query(async ({ input }): Promise<Spot[]> => {
      const RADIUS_M = 300;
      const latDelta = RADIUS_M / EARTH_RADIUS_M * (180 / Math.PI);
      const lngDelta = latDelta / Math.cos((input.lat * Math.PI) / 180);

      const candidates = await findSpotsInBoundingBox({
        latMin: input.lat - latDelta,
        latMax: input.lat + latDelta,
        lngMin: input.lng - lngDelta,
        lngMax: input.lng + lngDelta,
      });

      return candidates
        .filter((s) => {
          const dist = haversineDistance(input.lat, input.lng, Number(s.lat), Number(s.lng));
          return dist <= RADIUS_M;
        })
        .map((spot) => ({
          id: spot.id,
          name: spot.name,
          location: spot.location,
          coords: [Number(spot.lat), Number(spot.lng)] as [number, number],
          status: (spot.status as SpotStatus) || SPOT_STATUS.VERIFIED,
        }));
    }),

  /** Creates a new spot. Proximity check is enforced client-side; server only persists. */
  create: protectedProcedure
    .input(
      z.object({
        name: spotNameSchema,
        location: spotLocationSchema,
        lat: z.number(),
        lng: z.number(),
      }),
    )
    .mutation(async ({ input, ctx }): Promise<Spot> => {
      const spot = await createSpot({
        name: input.name,
        location: input.location,
        lat: input.lat,
        lng: input.lng,
        status: SPOT_STATUS.UNVERIFIED,
        creatorId: ctx.user.id,
      });
      return {
        id: spot.id,
        name: spot.name,
        location: spot.location,
        coords: [Number(spot.lat), Number(spot.lng)] as [number, number],
        status: SPOT_STATUS.UNVERIFIED,
      };
    }),

  /** Appends an alias to an existing spot (instant, no moderation). */
  addAlias: protectedProcedure
    .input(z.object({ spotId: z.string(), alias: spotAliasSchema }))
    .mutation(async ({ input }) => {
      const spot = await findSpotById(input.spotId);
      if (!spot) throw new NotFoundError('Spot');
      if (spot.aliases.includes(input.alias)) return { ok: true }; // idempotent

      await pushSpotAlias(input.spotId, input.alias);
      return { ok: true };
    }),

  details: publicProcedure.input(z.string()).query(async ({ input: id }) => {
    const spot = await findSpotDetails(id);
    if (!spot) return null;
    return {
      id: spot.id,
      name: spot.name,
      location: spot.location,
      status: spot.status,
      lat: spot.lat ? Number(spot.lat) : null,
      lng: spot.lng ? Number(spot.lng) : null,
      media: spot.mediaItems.map(mapPrismaToMediaItem),
    };
  }),

  card: publicProcedure.input(z.string()).query(async ({ input: id }) => {
    const spot = await findSpotCard(id);
    if (!spot) return null;
    return {
      id: spot.id,
      name: spot.name,
      location: spot.location,
      media: spot.mediaItems.map((m) => ({ id: m.id, url: m.lightboxUrl, type: m.type })),
      totalMedia: spot._count.mediaItems,
    };
  }),

  drafts: protectedProcedure.input(z.string()).query(async ({ input: spotId, ctx }) => {
    const items = await prisma.mediaItem.findMany({
      where: {
        spotId,
        photographerId: ctx.user.id,
        status: 'DRAFT',
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });
    return items.map(mapPrismaToMediaItem);
  }),
});
