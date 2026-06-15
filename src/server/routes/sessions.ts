import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from 'server/trpc';
import { surfSessionRepository } from 'server/repositories/SurfSessionRepository';
import { mediaRepository } from 'server/repositories/MediaRepository';
import { MIN_MEDIA_PRICE_CENTS } from 'entities/Media';

export const sessionsRouter = router({
  /** Create a session and atomically attach + publish the specified draft media items. */
  createAndPublish: protectedProcedure
    .input(
      z.object({
        spotId: z.uuid(),
        startsAt: z.coerce.date(),
        endsAt: z.coerce.date(),
        mediaIds: z.array(z.string().uuid()).min(1),
        photoPrice: z.number().int().min(MIN_MEDIA_PRICE_CENTS),
        videoPrice: z.number().int().min(MIN_MEDIA_PRICE_CENTS),
      }),
    )
    .mutation(({ input, ctx }) =>
      surfSessionRepository.createAndPublish({
        spotId: input.spotId,
        photographerId: ctx.user.id,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        mediaIds: input.mediaIds,
        photoPrice: input.photoPrice,
        videoPrice: input.videoPrice,
      }),
    ),

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

  /** Paginated list of published sessions, optionally filtered by spot and date range. */
  list: publicProcedure
    .input(
      z.object({
        spotId: z.uuid().optional(),
        cursor: z.uuid().optional(),
        limit: z.number().min(1).max(50).default(20),
        dateFrom: z.coerce.date().optional(),
        dateTo: z.coerce.date().optional(),
      }),
    )
    .query(({ input }) =>
      surfSessionRepository.listPublished({
        spotId: input.spotId,
        cursor: input.cursor,
        limit: input.limit,
        dateFrom: input.dateFrom,
        dateTo: input.dateTo,
      }),
    ),

  /** All sessions belonging to the authenticated photographer. */
  mine: protectedProcedure.query(({ ctx }) =>
    surfSessionRepository.findByPhotographer(ctx.user.id),
  ),

  /** Single session by ID. */
  byId: publicProcedure
    .input(z.uuid())
    .query(({ input: sessionId }) => surfSessionRepository.findById(sessionId)),

  /** Published media items for a session. */
  media: publicProcedure
    .input(z.uuid())
    .query(({ input: sessionId }) => mediaRepository.findPublishedBySession(sessionId)),

  /** Publish all draft media in a session and mark the session as published. */
  publish: protectedProcedure
    .input(z.uuid())
    .mutation(({ input: sessionId, ctx }) =>
      surfSessionRepository.publish(sessionId, ctx.user.id),
    ),
});
