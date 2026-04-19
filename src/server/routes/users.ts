import { router, protectedProcedure } from 'server/trpc';
import { findPublishedByPhotographer, countDraftsBySpot } from 'server/repositories/MediaRepository';
import { anonymizeAndDelete } from 'server/repositories/UserRepository';

export const usersRouter = router({
  myUploads: protectedProcedure.query(async ({ ctx }) => {
    const items = await findPublishedByPhotographer(ctx.user.id);
    return items.map((m) => ({
      id: m.id,
      type: m.type,
      // Show the watermarked URL — photographer sees the public version of their media
      url: m.lightboxUrl,
      price: Number(m.price),
      capturedAt: m.capturedAt,
      spotId: m.spotId,
      spotName: m.spot.name,
      photographer: { id: m.photographerId, name: null as string | null },
    }));
  }),

  myDraftCounts: protectedProcedure.query(({ ctx }) => countDraftsBySpot(ctx.user.id)),

  deleteAccount: protectedProcedure.mutation(({ ctx }) => anonymizeAndDelete(ctx.user.id)),
});
