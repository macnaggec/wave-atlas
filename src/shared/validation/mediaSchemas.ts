import { z } from 'zod';
import { MEDIA_RESOURCE_TYPE, MIN_MEDIA_PRICE_CENTS } from 'shared/constants/media';

const cloudName =
  typeof process !== 'undefined'
    ? process.env.VITE_CLOUDINARY_CLOUD_NAME
    : (import.meta as { env?: Record<string, string> }).env?.VITE_CLOUDINARY_CLOUD_NAME;
const cloudinaryBase = cloudName ? `https://res.cloudinary.com/${cloudName}/` : null;

export const mediaCloudinaryUrlSchema = z.url().refine(
  (url) => !!cloudinaryBase && url.startsWith(cloudinaryBase),
  { message: 'URL must be a Cloudinary URL for this account' },
);

export const mediaCloudinaryResultSchema = z.object({
  publicId: z.string().min(1),
  thumbnailUrl: mediaCloudinaryUrlSchema,
  lightboxUrl: mediaCloudinaryUrlSchema,
  resourceType: z.enum([MEDIA_RESOURCE_TYPE.IMAGE, MEDIA_RESOURCE_TYPE.VIDEO]),
});

export const mediaCreateSchema = z.object({
  draftId: z.uuid(),
  cloudinaryResult: mediaCloudinaryResultSchema,
  capturedAt: z.coerce.date().optional(),
});

export const mediaUpdateSchema = z.object({
  id: z.uuid(),
  price: z.number().int().min(MIN_MEDIA_PRICE_CENTS).optional(),
  capturedAt: z.coerce.date().optional(),
});

export const mediaBatchUpdateSchema = z
  .object({
    mediaIds: z.array(z.uuid()).min(1),
    price: z.number().int().min(MIN_MEDIA_PRICE_CENTS).optional(),
    capturedAt: z.coerce.date().optional(),
    spotId: z.uuid().optional(),
  })
  .refine((d) => d.price !== undefined || d.capturedAt !== undefined || d.spotId !== undefined, {
    error: 'Must provide at least one of: price, capturedAt, spotId',
  });

export const registerDriveImportSchema = z.object({
  draftId: z.uuid(),
  remoteFileId: z.string().min(1),
  mimeType: z.string().min(1),
  accessToken: z.string().min(1),
});
