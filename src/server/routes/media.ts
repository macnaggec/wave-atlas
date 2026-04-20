import { z } from 'zod';
import { router, protectedProcedure } from 'server/trpc';
import { BadRequestError } from 'shared/errors';
import { createMedia, updateMedia, softDeleteMedia, hardDeleteMedia, mapPrismaToMediaItem } from 'server/repositories/MediaRepository';
import { ensureOwnsMedia } from 'server/lib/mediaAuth';
import { cloudinaryService } from 'server/services/CloudinaryService';
import { resourceTypeMapper } from 'server/services/ResourceTypeMapper';
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
    .mutation(async ({ input, ctx }) => {
      const { spotId, cloudinaryResult, capturedAt, price } = input;
      const resourceType = resourceTypeMapper.mapToMediaType(cloudinaryResult.resource_type);
      const media = await createMedia({
        spotId,
        photographerId: ctx.user.id,
        type: resourceType,
        cloudinaryPublicId: cloudinaryResult.publicId,
        thumbnailUrl: cloudinaryResult.thumbnailUrl,
        lightboxUrl: cloudinaryResult.lightboxUrl,
        capturedAt: capturedAt ?? new Date(),
        price: price ?? 0,
        status: MEDIA_STATUS.DRAFT,
      });
      return mapPrismaToMediaItem(media);
    }),

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
    .mutation(async ({ input, ctx }) => {
      const { id, price, status } = input;
      await ensureOwnsMedia(ctx.user.id, id);
      const updated = await updateMedia(id, { price, status });
      return mapPrismaToMediaItem(updated);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.uuid() }))
    .mutation(async ({ input, ctx }) => {
      const media = await ensureOwnsMedia(ctx.user.id, input.id);
      if (media.status === MEDIA_STATUS.DRAFT) {
        await hardDeleteMedia(input.id);
      } else {
        await softDeleteMedia(input.id);
      }
      return true;
    }),

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
    .mutation(async ({ input, ctx }) => {
      const { mediaIds, price, capturedAt } = input;
      await Promise.all(
        mediaIds.map(async (id) => {
          const item = await ensureOwnsMedia(ctx.user.id, id);
          if (item.status !== MEDIA_STATUS.DRAFT) {
            throw new BadRequestError(`Media ${id} is not a draft`);
          }
        })
      );
      const updateData: { price?: number; capturedAt?: Date } = {};
      if (price !== undefined) updateData.price = price;
      if (capturedAt) updateData.capturedAt = capturedAt;
      const updated = await Promise.all(mediaIds.map((id) => updateMedia(id, updateData)));
      return updated.map(mapPrismaToMediaItem);
    }),

  publish: protectedProcedure
    .input(
      z.object({
        mediaIds: z.array(z.uuid()).min(1),
        price: z.number().min(0).optional(),
        capturedAt: z.coerce.date().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { mediaIds, price, capturedAt } = input;
      await Promise.all(mediaIds.map((id) => ensureOwnsMedia(ctx.user.id, id)));
      const updateData: { status: typeof MEDIA_STATUS.PUBLISHED; price?: number; capturedAt?: Date } =
        { status: MEDIA_STATUS.PUBLISHED };
      if (price !== undefined) updateData.price = price;
      if (capturedAt) updateData.capturedAt = capturedAt;
      const updated = await Promise.all(mediaIds.map((id) => updateMedia(id, updateData)));
      return updated.map(mapPrismaToMediaItem);
    }),
});
