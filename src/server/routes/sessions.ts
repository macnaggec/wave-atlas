import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from 'server/trpc';
import { surfSessionRepository } from 'server/repositories/SurfSessionRepository';
import { surfSessionService } from 'server/services/SurfSessionService';
import { mediaService } from 'server/services/MediaService';
import { MIN_MEDIA_PRICE_CENTS } from 'shared/constants/media';

export const sessionsRouter = router({
  /** Return the photographer's active upload draft, creating it when absent. */
  create: protectedProcedure
    .input(
      z.object({
        spotId: z.uuid().nullable().optional(),
        startsAt: z.coerce.date().nullable().optional(),
        endsAt: z.coerce.date().nullable().optional(),
        photoPrice: z.number().int().min(MIN_MEDIA_PRICE_CENTS).optional(),
        videoPrice: z.number().int().min(MIN_MEDIA_PRICE_CENTS).optional(),
      }),
    )
    .mutation(({ input, ctx }) =>
      surfSessionService.create(ctx.user.id, {
        spotId: input.spotId,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        photoPrice: input.photoPrice,
        videoPrice: input.videoPrice,
      }),
    ),

  draft: protectedProcedure
    .input(z.uuid())
    .query(({ input: sessionId, ctx }) => surfSessionService.getDraft(ctx.user.id, sessionId)),

  latestDraft: protectedProcedure.query(({ ctx }) =>
    surfSessionRepository.findLatestDraftByPhotographer(ctx.user.id),
  ),

  updateDraft: protectedProcedure
    .input(
      z.object({
        draftId: z.uuid(),
        spotId: z.uuid().nullable().optional(),
        startsAt: z.coerce.date().nullable().optional(),
        endsAt: z.coerce.date().nullable().optional(),
        photoPrice: z.number().int().min(MIN_MEDIA_PRICE_CENTS).optional(),
        videoPrice: z.number().int().min(MIN_MEDIA_PRICE_CENTS).optional(),
      }).refine(
        ({ draftId: _draftId, ...changes }) => Object.values(changes).some((value) => value !== undefined),
        'At least one draft field is required',
      ),
    )
    .mutation(({ input: { draftId, ...changes }, ctx }) =>
      surfSessionService.updateDraft(ctx.user.id, draftId, changes),
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
    .query(({ input: sessionId }) => surfSessionRepository.findPublishedById(sessionId)),

  /** Published media items for a session. */
  media: publicProcedure
    .input(z.uuid())
    .query(({ input: sessionId, ctx }) => mediaService.findPublishedBySession(sessionId, ctx.user?.id)),

  /** Publish all draft media in a session and mark the session as published. */
  publish: protectedProcedure
    .input(z.uuid())
    .mutation(({ input: sessionId, ctx }) =>
      surfSessionService.publish(ctx.user.id, sessionId),
    ),
});
