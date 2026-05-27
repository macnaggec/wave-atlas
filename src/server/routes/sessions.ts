import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from 'server/trpc';
import { surfSessionRepository } from 'server/repositories/SurfSessionRepository';

export const sessionsRouter = router({
  /** Create a new surf session (spot + time window). Returns sessionId + spotId. */
  create: protectedProcedure
    .input(
      z.object({
        spotId: z.uuid(),
        startsAt: z.coerce.date(),
        endsAt: z.coerce.date(),
      }),
    )
    .mutation(({ input, ctx }) =>
      surfSessionRepository.create({
        spotId: input.spotId,
        photographerId: ctx.user.id,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
      }),
    ),

  /** Draft media for a specific session (authenticated, must be the owner). */
  draftMedia: protectedProcedure
    .input(z.uuid())
    .query(({ input: sessionId, ctx }) =>
      surfSessionRepository.findDraftMediaBySession(sessionId, ctx.user.id),
    ),

  /** Paginated list of published sessions, optionally filtered by spot. */
  list: publicProcedure
    .input(
      z.object({
        spotId: z.uuid().optional(),
        cursor: z.uuid().optional(),
        limit: z.number().min(1).max(50).default(20),
      }),
    )
    .query(({ input }) =>
      surfSessionRepository.listPublished({
        spotId: input.spotId,
        cursor: input.cursor,
        limit: input.limit,
      }),
    ),

  /** All sessions belonging to the authenticated photographer. */
  mine: protectedProcedure.query(({ ctx }) =>
    surfSessionRepository.findByPhotographer(ctx.user.id),
  ),

  /** Publish all draft media in a session and mark the session as published. */
  publish: protectedProcedure
    .input(z.uuid())
    .mutation(({ input: sessionId, ctx }) =>
      surfSessionRepository.publish(sessionId, ctx.user.id),
    ),
});
