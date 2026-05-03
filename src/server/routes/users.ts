import { router, protectedProcedure } from 'server/trpc';
import { mediaRepository } from 'server/repositories/MediaRepository';
import { userRepository } from 'server/repositories/UserRepository';

export const usersRouter = router({
  myUploads: protectedProcedure.query(async ({ ctx }) => {
    const items = await mediaRepository.findPublishedByPhotographer(ctx.user.id);
    return items.map((m) => ({
      id: m.id,
      type: m.type,
      // Show the watermarked URL — photographer sees the public version of their media
      url: m.lightboxUrl,
      price: Number(m.price),
      capturedAt: m.capturedAt,
      spotId: m.spotId,
      spotName: m.spot?.name ?? null,
      photographer: { id: m.photographerId, name: null as string | null },
    }));
  }),

  myDraftCounts: protectedProcedure.query(({ ctx }) => mediaRepository.countDraftsBySpot(ctx.user.id)),

  deleteAccount: protectedProcedure.mutation(({ ctx }) => userRepository.anonymizeAndDelete(ctx.user.id)),
});
