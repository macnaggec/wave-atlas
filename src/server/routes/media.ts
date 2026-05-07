import { router, protectedProcedure } from 'server/trpc';
import { mediaService } from 'server/services/MediaService';
import { cloudinaryService } from 'server/services/CloudinaryService';
import { createRateLimiter } from 'server/lib/rateLimiter';
import {
  mediaCreateSchema,
  mediaUpdateSchema,
  mediaBatchUpdateSchema,
  mediaPublishSchema,
} from 'shared/validation/mediaSchemas';
import { z } from 'zod';

// 10 upload signature requests per user per minute
const signCloudinaryLimiter = createRateLimiter({ windowMs: 60_000, max: 10 });

// tRPC inputs carry price in dollars (human-readable). Convert once here so the
// service layer operates entirely in cents.
const toCents = (dollars: number) => Math.round(dollars * 100);

export const mediaRouter = router({
  signCloudinary: protectedProcedure
    .use(({ ctx, next }) => {
      signCloudinaryLimiter(ctx.user.id);
      return next();
    })
    .mutation(({ ctx }) =>
      cloudinaryService.generateUploadSignature(`wave-atlas/users/${ctx.user.id}`)
    ),

  create: protectedProcedure
    .input(mediaCreateSchema)
    .mutation(({ input, ctx }) =>
      mediaService.createMedia(ctx.user.id, {
        ...input,
        price: input.price !== undefined ? toCents(input.price) : undefined,
      })
    ),

  update: protectedProcedure
    .input(mediaUpdateSchema)
    .mutation(({ input, ctx }) =>
      mediaService.updateMedia(ctx.user.id, input.id, {
        price: input.price !== undefined ? toCents(input.price) : undefined,
        status: input.status,
      })
    ),

  delete: protectedProcedure
    .input(z.object({ id: z.uuid() }))
    .mutation(({ input, ctx }) => mediaService.deleteMedia(ctx.user.id, input.id)),

  updateBatch: protectedProcedure
    .input(mediaBatchUpdateSchema)
    .mutation(({ input, ctx }) =>
      mediaService.updateBatch(ctx.user.id, input.mediaIds, {
        price: input.price !== undefined ? toCents(input.price) : undefined,
        capturedAt: input.capturedAt,
      })
    ),

  publish: protectedProcedure
    .input(mediaPublishSchema)
    .mutation(({ input, ctx }) =>
      mediaService.publish(ctx.user.id, input.mediaIds, {
        price: input.price !== undefined ? toCents(input.price) : undefined,
        capturedAt: input.capturedAt,
      })
    ),
});
