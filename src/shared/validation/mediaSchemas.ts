import { z } from 'zod';
import { MEDIA_STATUS } from 'entities/Media/constants';

const cloudName = process.env.VITE_CLOUDINARY_CLOUD_NAME;
const cloudinaryBase = cloudName ? `https://res.cloudinary.com/${cloudName}/` : null;

export const mediaCloudinaryUrlSchema = z.url().refine(
  (url) => !!cloudinaryBase && url.startsWith(cloudinaryBase),
  { message: 'URL must be a Cloudinary URL for this account' },
);

export const mediaCloudinaryResultSchema = z.object({
  publicId: z.string().min(1),
  thumbnailUrl: mediaCloudinaryUrlSchema,
  lightboxUrl: mediaCloudinaryUrlSchema,
  resource_type: z.string().optional().default('image'),
});

export const mediaCreateSchema = z.object({
  spotId: z.uuid(),
  cloudinaryResult: mediaCloudinaryResultSchema,
  capturedAt: z.coerce.date().optional(),
  price: z.number().min(0).optional(),
});

export const mediaUpdateSchema = z.object({
  id: z.uuid(),
  price: z.number().min(0).optional(),
  status: z.enum([MEDIA_STATUS.DRAFT, MEDIA_STATUS.PUBLISHED, MEDIA_STATUS.DELETED]).optional(),
});

export const mediaBatchUpdateSchema = z
  .object({
    mediaIds: z.array(z.uuid()).min(1),
    price: z.number().min(0).optional(),
    capturedAt: z.coerce.date().optional(),
  })
  .refine((d) => d.price !== undefined || d.capturedAt !== undefined, {
    error: 'Must provide at least price or capturedAt',
  });

export const mediaPublishSchema = z.object({
  mediaIds: z.array(z.uuid()).min(1),
  price: z.number().min(0).optional(),
  capturedAt: z.coerce.date().optional(),
});
