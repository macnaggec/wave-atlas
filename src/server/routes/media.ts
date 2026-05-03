import { z } from 'zod';
import { router, protectedProcedure } from 'server/trpc';
import { mediaService } from 'server/services/MediaService';
import { cloudinaryService } from 'server/services/CloudinaryService';
import { MEDIA_STATUS, MEDIA_UPLOAD_CONFIG } from 'entities/Media/constants';

export const mediaRouter = router({
  signCloudinary: protectedProcedure
    .input(z.object({ folder: z.string().optional() }))
    .mutation(({ input }) =>
      cloudinaryService.generateUploadSignature(input.folder ?? MEDIA_UPLOAD_CONFIG.FOLDER)
    ),

  create: protectedProcedure
    .input(
      z.object({
        spotId: z.uuid(),
        cloudinaryResult: z.object({
          publicId: z.string().min(1),
          thumbnailUrl: z.url(),
          lightboxUrl: z.url(),
          resource_type: z.string().optional().default('image'),
        }),
        capturedAt: z.coerce.date().optional(),
        price: z.number().min(0).optional(),
      })
    )
    .mutation(({ input, ctx }) => mediaService.createMedia(ctx.user.id, input)),

  update: protectedProcedure
    .input(
      z.object({
        id: z.uuid(),
        price: z.number().min(0).optional(),
        status: z
          .enum([MEDIA_STATUS.DRAFT, MEDIA_STATUS.PUBLISHED, MEDIA_STATUS.DELETED])
          .optional(),
      })
    )
    .mutation(({ input, ctx }) =>
      mediaService.updateMedia(ctx.user.id, input.id, { price: input.price, status: input.status })
    ),

  delete: protectedProcedure
    .input(z.object({ id: z.uuid() }))
    .mutation(({ input, ctx }) => mediaService.deleteMedia(ctx.user.id, input.id)),

  updateBatch: protectedProcedure
    .input(
      z
        .object({
          mediaIds: z.array(z.uuid()).min(1),
          price: z.number().min(0).optional(),
          capturedAt: z.coerce.date().optional(),
        })
        .refine((d) => d.price !== undefined || d.capturedAt !== undefined, {
          error: 'Must provide at least price or capturedAt',
        })
    )
    .mutation(({ input, ctx }) =>
      mediaService.updateBatch(ctx.user.id, input.mediaIds, { price: input.price, capturedAt: input.capturedAt })
    ),

  publish: protectedProcedure
    .input(
      z.object({
        mediaIds: z.array(z.uuid()).min(1),
        price: z.number().min(0).optional(),
        capturedAt: z.coerce.date().optional(),
      })
    )
    .mutation(({ input, ctx }) =>
      mediaService.publish(ctx.user.id, input.mediaIds, { price: input.price, capturedAt: input.capturedAt })
    ),
});
