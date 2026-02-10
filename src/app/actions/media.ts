'use server';

import { mediaRepository } from 'shared/api/repositories/MediaRepository';
import { mediaAuthService } from 'shared/services/MediaAuthorizationService';
import { cloudinaryService } from 'shared/services/CloudinaryService';
import { cacheService } from 'shared/services/CacheInvalidationService';
import { resourceTypeMapper } from 'shared/services/ResourceTypeMapper';
import { MediaItem } from 'entities/Media/types';
import { MEDIA_STATUS, MEDIA_UPLOAD_CONFIG } from 'entities/Media/constants';
import { mapPrismaToMediaItem } from 'entities/Media/mapper';
import { createProtectedAction, createProtectedActionResult } from 'shared/lib/safeAction';

import { z } from 'zod';

const getSignatureSchema = z.object({
  folder: z.string().optional(),
});

export const getCloudinarySignature = createProtectedAction(
  getSignatureSchema,
  async ({ folder = MEDIA_UPLOAD_CONFIG.FOLDER }) => {
    return cloudinaryService.generateUploadSignature(folder);
  }
);

/**
 * Optimized schema - only validates fields actually used by the action
 * Follows Interface Segregation Principle
 */
const createMediaSchema = z.object({
  spotId: z.uuid(),
  cloudinaryResult: z.object({
    secure_url: z.string().url(),
    resource_type: z.string().optional().default('image'),
  }),
  capturedAt: z.coerce.date().optional(),
  price: z.number().min(0).optional(),
});

/**
 * Server Action: Create new media item from Cloudinary upload
 */
export const createMediaItem = createProtectedAction(
  createMediaSchema,
  async (params, { user }): Promise<MediaItem> => {
    const { spotId, cloudinaryResult, capturedAt, price } = params;

    const resourceType = resourceTypeMapper.mapToMediaType(
      cloudinaryResult.resource_type
    );

    const media = await mediaRepository.create({
      spotId,
      photographerId: user.id,
      type: resourceType,
      originalUrl: cloudinaryResult.secure_url,
      watermarkUrl: cloudinaryResult.secure_url, // TODO: Add watermark transformation logic
      capturedAt: capturedAt || new Date(),
      price: price || 0,
      status: MEDIA_STATUS.DRAFT, // Save as draft initially
    });

    // Don't invalidate cache for drafts - they shouldn't appear publicly

    return mapPrismaToMediaItem(media);
  }
);

/**
 * Schema for updating media properties
 * Only allows modification of price and status
 */
const updateMediaSchema = z.object({
  id: z.string(),
  price: z.number().optional(),
  status: z.enum([MEDIA_STATUS.DRAFT, MEDIA_STATUS.PUBLISHED, MEDIA_STATUS.DELETED]).optional(),
});

/**
 * Server Action: Update media item
 */
export const updateMedia = createProtectedActionResult(
  updateMediaSchema,
  async (params, { user }): Promise<MediaItem> => {
    const { id, price, status } = params;

    // Check permissions (returns media for potential spotId use)
    await mediaAuthService.ensureCanModify(user.id, id);

    const updated = await mediaRepository.update(id, {
      price,
      status,
    });

    cacheService.invalidateUserUploads();

    return mapPrismaToMediaItem(updated);
  }
);

/**
 * Schema for deleting media
 * Validates media ID as UUID
 */
const deleteMediaSchema = z.object({
  id: z.uuid(),
});

/**
 * Server Action: Delete media item
 * Returns ActionResult for cleaner error handling in UI
 */
export const deleteMedia = createProtectedActionResult(
  deleteMediaSchema,
  async ({ id }, { user }): Promise<boolean> => {
    // Check permissions and get media item
    const media = await mediaAuthService.ensureCanDelete(user.id, id);

    // Drafts: hard delete (permanent removal)
    // Published: soft delete (mark as deleted, preserve for history)
    if (media.status === MEDIA_STATUS.DRAFT) {
      await mediaRepository.hardDelete(id);
    } else {
      await mediaRepository.softDelete(id);
    }

    cacheService.invalidateUserUploads();

    // Also invalidate the spot page cache
    cacheService.invalidateSpotMedia(media.spotId);

    return true;
  }
);

const getUserMediaSchema = z.void();

/**
 * Server Action: Get user's media items
 */
export const getUserMedia = createProtectedAction(
  getUserMediaSchema,
  async (_, { user }): Promise<MediaItem[]> => {
    const items = await mediaRepository.findMany({
      photographerId: user.id,
      status: MEDIA_STATUS.PUBLISHED,
    });

    return items.map(mapPrismaToMediaItem);
  }
);

const getDraftMediaSchema = z.object({
  spotId: z.string().min(1),
});

/**
 * Server Action: Get user's draft media items (unpublished) for a specific spot
 */
export const getDraftMedia = createProtectedAction(
  getDraftMediaSchema,
  async ({ spotId }, { user }): Promise<MediaItem[]> => {
    const items = await mediaRepository.findMany({
      photographerId: user.id,
      spotId,
      status: MEDIA_STATUS.DRAFT,
    });

    return items.map(mapPrismaToMediaItem);
  }
);

/**
 * Schema for publishing media items
 * Validates all required fields for publishing
 */
const publishMediaSchema = z.object({
  mediaIds: z.array(z.uuid()).min(1),
  price: z.number().min(0).optional(),
  capturedAt: z.coerce.date().optional(),
});

/**
 * Schema: Update draft metadata
 */
const updateDraftMetadataSchema = z.object({
  mediaIds: z.array(z.uuid()).min(1),
  price: z.number().min(0).optional(),
  capturedAt: z.coerce.date().optional(),
}).refine(
  (data) => data.price !== undefined || data.capturedAt !== undefined,
  { message: 'Must provide at least price or capturedAt' }
);

/**
 * Server Action: Update draft media metadata
 * Updates price and/or capturedAt for draft items without publishing
 * Used by BulkEditToolbar for batch price/date operations
 */
export const updateDraftMetadata = createProtectedActionResult(
  updateDraftMetadataSchema,
  async ({ mediaIds, price, capturedAt }, { user }): Promise<MediaItem[]> => {
    // Verify ownership and draft status of all media items
    const items = await Promise.all(
      mediaIds.map(async (id) => {
        await mediaAuthService.ensureCanModify(user.id, id);
        const item = await mediaRepository.findById(id);
        if (item?.status !== MEDIA_STATUS.DRAFT) {
          throw new Error(`Media ${id} is not a draft`);
        }
        return item;
      })
    );

    // Build update data - only include provided fields
    const updateData: { price?: number; capturedAt?: Date } = {};
    if (price !== undefined) updateData.price = price;
    if (capturedAt) updateData.capturedAt = capturedAt;

    // Update all items
    const updated = await Promise.all(
      mediaIds.map((id) => mediaRepository.update(id, updateData))
    );

    // No cache invalidation needed - drafts are user-scoped and fetched fresh
    return updated.map(mapPrismaToMediaItem);
  }
);

/**
 * Server Action: Publish draft media items
 * Updates status to PUBLISHED and optionally updates price/capturedAt
 */
export const publishMediaItems = createProtectedActionResult(
  publishMediaSchema,
  async ({ mediaIds, price, capturedAt }, { user }): Promise<MediaItem[]> => {
    // Verify ownership of all media items
    await Promise.all(
      mediaIds.map((id) => mediaAuthService.ensureCanModify(user.id, id))
    );

    // Update all items
    const updateData: { status: typeof MEDIA_STATUS.PUBLISHED; price?: number; capturedAt?: Date } = {
      status: MEDIA_STATUS.PUBLISHED,
    };

    if (price !== undefined) updateData.price = price;
    if (capturedAt) updateData.capturedAt = capturedAt;

    const updated = await Promise.all(
      mediaIds.map((id) => mediaRepository.update(id, updateData))
    );

    // Invalidate caches - published items should now appear
    const spotIds = Array.from(new Set(updated.map((item) => item.spotId)));
    spotIds.forEach((spotId) => cacheService.invalidateMediaPaths(spotId));
    cacheService.invalidateUserUploads();

    return updated.map(mapPrismaToMediaItem);
  }
);
