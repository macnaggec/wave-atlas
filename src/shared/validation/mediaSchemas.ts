import { z } from 'zod';
import { MEDIA_STATUS, MEDIA_RESOURCE_TYPE, MIN_MEDIA_PRICE_CENTS } from 'entities/Media/constants';

export const mediaCloudinaryResultSchema = z.object({
  publicId: z.string().min(1),
  thumbnailUrl: z.url(),
  lightboxUrl: z.url(),
  resource_type: z.enum([MEDIA_RESOURCE_TYPE.IMAGE, MEDIA_RESOURCE_TYPE.VIDEO]),
});

export const mediaCreateSchema = z.object({
  spotId: z.uuid(),
  cloudinaryResult: mediaCloudinaryResultSchema,
  capturedAt: z.coerce.date().optional(),
  price: z.number().min(0).optional(),
});

export const mediaUpdateSchema = z.object({
  id: z.uuid(),
  price: z.number().min(MIN_MEDIA_PRICE_CENTS / 100, { message: `Price must be at least $${(MIN_MEDIA_PRICE_CENTS / 100).toFixed(2)}` }).optional(),
  status: z.enum([MEDIA_STATUS.DRAFT, MEDIA_STATUS.PUBLISHED, MEDIA_STATUS.DELETED]).optional(),
});

const mediaPriceableBase = z.object({
  mediaIds: z.array(z.uuid()).min(1),
  price: z.number().min(MIN_MEDIA_PRICE_CENTS / 100, { message: `Price must be at least $${(MIN_MEDIA_PRICE_CENTS / 100).toFixed(2)}` }).optional(),
  capturedAt: z.coerce.date().optional(),
});

export const mediaBatchUpdateSchema = mediaPriceableBase.refine(
  (d) => d.price !== undefined || d.capturedAt !== undefined,
  { error: 'Must provide at least price or capturedAt' },
);

export const mediaPublishSchema = mediaPriceableBase;
