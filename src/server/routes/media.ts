import { router, protectedProcedure } from 'server/trpc';
import { mediaService } from 'server/services/MediaService';
import { createRateLimiter } from 'server/lib/rateLimiter';
import {
  mediaCreateSchema,
  mediaUpdateSchema,
  mediaBatchUpdateSchema,
  mediaPublishSchema,
  registerDriveImportSchema,
} from 'entities/Media/lib/mediaSchemas';
import { z } from 'zod';

// 10 upload signature requests per user per minute
const signCloudinaryLimiter = createRateLimiter({ windowMs: 60_000, max: 10 });

export const mediaRouter = router({
  signCloudinary: protectedProcedure
    .use(({ ctx, next }) => {
      signCloudinaryLimiter(ctx.user.id);
      return next();
    })
    .mutation(({ ctx }) =>
      mediaService.generateUploadSignature(ctx.user.id)
    ),

  create: protectedProcedure
    .input(mediaCreateSchema)
    .mutation(({ input, ctx }) => mediaService.createMedia(ctx.user.id, input)),

  update: protectedProcedure
    .input(mediaUpdateSchema)
    .mutation(({ input, ctx }) =>
      mediaService.updateMedia(ctx.user.id, input.id, { price: input.price })
    ),

  delete: protectedProcedure
    .input(z.object({ id: z.uuid() }))
    .mutation(({ input, ctx }) => mediaService.deleteMedia(ctx.user.id, input.id)),

  updateBatch: protectedProcedure
    .input(mediaBatchUpdateSchema)
    .mutation(({ input, ctx }) =>
      mediaService.updateBatch(ctx.user.id, input.mediaIds, { price: input.price, capturedAt: input.capturedAt })
    ),

  updatePublishedBatch: protectedProcedure
    .input(mediaBatchUpdateSchema)
    .mutation(({ input, ctx }) =>
      mediaService.updatePublishedBatch(ctx.user.id, input.mediaIds, { price: input.price, capturedAt: input.capturedAt })
    ),

  unpublishBatch: protectedProcedure
    .input(z.object({ mediaIds: z.array(z.uuid()).min(1) }))
    .mutation(({ input, ctx }) =>
      mediaService.unpublishBatch(ctx.user.id, input.mediaIds)
    ),

  publish: protectedProcedure
    .input(mediaPublishSchema)
    .mutation(({ input, ctx }) =>
      mediaService.publish(ctx.user.id, input.mediaIds, { price: input.price, capturedAt: input.capturedAt })
    ),

  registerDriveImport: protectedProcedure
    .input(registerDriveImportSchema)
    .mutation(({ input, ctx }) => mediaService.registerDriveImport(ctx.user.id, input)),
});
