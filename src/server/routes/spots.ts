import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from 'server/trpc';
import {
  findSpotList,
  findSpotsNearby,
  findSpotById,
  createSpot,
  pushSpotAlias,
  findSpotDetails,
  findSpotCard,
} from 'server/repositories/SpotRepository';
import { SPOT_STATUS } from 'entities/Spot/constants';
import type { Spot } from 'entities/Spot/types';
import { mapPrismaToMediaItem, findDraftsBySpot } from 'server/repositories/MediaRepository';
import { spotNameSchema, spotLocationSchema, spotAliasSchema } from 'shared/validation/spotSchemas';
import { NotFoundError } from 'shared/errors';

export const spotsRouter = router({
  list: publicProcedure
    .input(z.string().optional())
    .query(({ input: search }): Promise<Spot[]> => findSpotList({ search })),

  /** Returns spots within 300 m of the given coordinates. Used for proximity deduplication. */
  nearby: publicProcedure
    .input(z.object({ lat: z.number(), lng: z.number() }))
    .query(({ input }): Promise<Spot[]> => findSpotsNearby(input.lat, input.lng, 300)),

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
    .mutation(({ input, ctx }): Promise<Spot> =>
      createSpot({
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
      const spot = await findSpotById(input.spotId);
      if (!spot) throw new NotFoundError('Spot');
      if (spot.aliases.includes(input.alias)) return { ok: true }; // idempotent

      await pushSpotAlias(input.spotId, input.alias);

      return { ok: true };
    }),

  details: publicProcedure
    .input(z.string())
    .query(async ({ input: id }) => {
      const spot = await findSpotDetails(id);
      if (!spot) return null;

      return {
        ...spot,
        media: spot.mediaItems.map(mapPrismaToMediaItem),
      };
    }),

  card: publicProcedure.input(z.string()).query(({ input: id }) => findSpotCard(id)),

  drafts: protectedProcedure
    .input(z.string())
    .query(async ({ input: spotId, ctx }) => {
      const items = await findDraftsBySpot(spotId, ctx.user.id);
      return items.map(mapPrismaToMediaItem);
    }),
});
