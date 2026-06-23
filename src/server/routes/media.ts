import { router, protectedProcedure } from 'server/trpc';
import { mediaService } from 'server/services/MediaService';
import {
  mediaUpdateSchema,
  mediaBatchUpdateSchema,
} from 'shared/validation/mediaSchemas';
import { z } from 'zod';

export const mediaRouter = router({
  update: protectedProcedure
    .input(mediaUpdateSchema)
    .mutation(({ input, ctx }) =>
      mediaService.updateMedia(ctx.user.id, input.id, { price: input.price })
    ),

  delete: protectedProcedure
    .input(z.object({ id: z.uuid() }))
    .mutation(({ input, ctx }) => mediaService.deleteMedia(ctx.user.id, input.id)),

  deleteBatch: protectedProcedure
    .input(z.object({ ids: z.array(z.uuid()).min(1) }))
    .mutation(({ input, ctx }) => mediaService.deleteMediaBatch(ctx.user.id, input.ids)),

  updateBatch: protectedProcedure
    .input(mediaBatchUpdateSchema)
    .mutation(({ input, ctx }) =>
      mediaService.updateBatch(ctx.user.id, input.mediaIds, { price: input.price, capturedAt: input.capturedAt, spotId: input.spotId })
    ),

  updatePublishedBatch: protectedProcedure
    .input(mediaBatchUpdateSchema)
    .mutation(({ input, ctx }) =>
      mediaService.updatePublishedBatch(ctx.user.id, input.mediaIds, { price: input.price, capturedAt: input.capturedAt })
    ),

  myDrafts: protectedProcedure
    .query(({ ctx }) => mediaService.getMyDrafts(ctx.user.id)),
});
