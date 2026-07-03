import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from 'server/trpc';
import { mediaRepository } from 'server/repositories/MediaRepository';
import { mediaService } from 'server/services/MediaService';
import { spotRepository } from 'server/repositories/SpotRepository';
import { SPOT_STATUS } from 'shared/types';
import type { Spot } from 'shared/types';
import { spotNameSchema, spotLocationSchema, spotAliasSchema } from 'shared/validation/spotSchemas';
import { NotFoundError } from 'shared/errors';

export const spotsRouter = router({
  list: publicProcedure
    .input(z.string().optional())
    .query(({ input: search }): Promise<Spot[]> => spotRepository.findSpotList({ search })),

  byId: publicProcedure
    .input(z.string().min(1))
    .query(async ({ input: id }): Promise<Spot | null> => {
      const row = await spotRepository.findSpotById(id);
      if (!row) return null;
      return {
        id: row.id,
        name: row.name,
        location: row.location,
        coords: row.coords,
        status: row.status,
      };
    }),

  withinBounds: publicProcedure
    .input(z.object({
      swLat: z.number(),
      swLng: z.number(),
      neLat: z.number(),
      neLng: z.number(),
    }))
    .query(({ input }): Promise<Spot[]> =>
      spotRepository.findSpotsByBounds(input.swLat, input.swLng, input.neLat, input.neLng)
    ),

  /** Returns spots within 300 m so the create flow can warn about a possible duplicate. */
  nearby: publicProcedure
    .input(z.object({ lat: z.number(), lng: z.number() }))
    .query(({ input }): Promise<Spot[]> => spotRepository.findSpotsNearby(input.lat, input.lng, 300)),

  /** Creates a new spot. Nearby results are advisory; users may intentionally create close spots. */
  create: protectedProcedure
    .input(
      z.object({
        name: spotNameSchema,
        location: spotLocationSchema,
        lat: z.number(),
        lng: z.number(),
      }),
    )
    .mutation(({ input, ctx }): Promise<Spot> =>
      spotRepository.createSpot({
        name: input.name,
        location: input.location,
        lat: input.lat,
        lng: input.lng,
        status: SPOT_STATUS.UNVERIFIED,
        creatorId: ctx.user.id,
      })
    ),

  /** Appends an alias to an existing spot (instant, no moderation). */
  addAlias: protectedProcedure
    .input(z.object({ spotId: z.string(), alias: spotAliasSchema }))
    .mutation(async ({ input }) => {
      const spot = await spotRepository.findSpotById(input.spotId);
      if (!spot) throw new NotFoundError('Spot');
      if (spot.aliases.includes(input.alias)) return { ok: true }; // idempotent

      await spotRepository.pushSpotAlias(input.spotId, input.alias);

      return { ok: true };
    }),

  mediaFeed: publicProcedure
    .input(
      z.object({
        spotId: z.string(),
        cursor: z.string().uuid().optional(),
        limit: z.number().min(1).max(100).default(30),
        sortOrder: z.enum(['asc', 'desc']).default('desc'),
      }),
    )
    .query(({ input, ctx }) =>
      mediaService.findPublishedBySpot(input.spotId, input.cursor, input.limit, input.sortOrder, ctx.user?.id)
    ),

  card: publicProcedure.input(z.string()).query(({ input: id }) => spotRepository.findSpotCard(id)),

  drafts: protectedProcedure
    .input(z.string())
    .query(({ input: spotId, ctx }) => mediaRepository.findDraftsBySpot(spotId, ctx.user.id)),
});
