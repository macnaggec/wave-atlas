import type { IMediaRepository } from 'server/repositories/MediaRepository';
import { mediaRepository } from 'server/repositories/MediaRepository';
import { MEDIA_STATUS, MIN_MEDIA_PRICE_CENTS } from 'entities/Media/constants';
import type { MediaStatus } from 'entities/Media/constants';
import type { MediaItem } from 'entities/Media/types';
import { BadRequestError, ForbiddenError, NotFoundError } from 'shared/errors';
import type { ICloudinaryService } from './CloudinaryService';
import { cloudinaryService } from './CloudinaryService';

function assertPriceFloor(price: number | undefined): void {
  if (price !== undefined && price < MIN_MEDIA_PRICE_CENTS) {
    throw new BadRequestError(`Price must be at least $${(MIN_MEDIA_PRICE_CENTS / 100).toFixed(2)}`);
  }
}

export type CreateMediaInput = {
  spotId: string;
  sessionId?: string;
  cloudinaryResult: {
    publicId: string;
    thumbnailUrl: string;
    lightboxUrl: string;
    resource_type: string;
  };
  capturedAt?: Date;
  price?: number;
};

export type UpdateMediaInput = {
  price?: number;
  status?: MediaStatus;
};

export type UpdateBatchInput = {
  price?: number;
  capturedAt?: Date;
  spotId?: string;
};

export type RegisterDriveImportInput = {
  spotId: string;
  sessionId?: string;
  remoteFileId: string;
  mimeType: string;
  accessToken: string;
};

export class MediaService {
  constructor(
    private media: IMediaRepository,
    private cloudinary: Pick<ICloudinaryService, 'uploadFromUrl' | 'deleteAsset' | 'generateUploadSignature'>,
  ) { }

  generateUploadSignature(userId: string) {
    return this.cloudinary.generateUploadSignature(`wave-atlas/users/${userId}`);
  }

  async createMedia(userId: string, input: CreateMediaInput): Promise<MediaItem> {
    return this.media.createMedia({
      spotId: input.spotId,
      sessionId: input.sessionId,
      photographerId: userId,
      resource_type: input.cloudinaryResult.resource_type as 'image' | 'video',
      cloudinaryPublicId: input.cloudinaryResult.publicId,
      thumbnailUrl: input.cloudinaryResult.thumbnailUrl,
      lightboxUrl: input.cloudinaryResult.lightboxUrl,
      capturedAt: input.capturedAt ?? new Date(),
      price: input.price ?? MIN_MEDIA_PRICE_CENTS,
      status: MEDIA_STATUS.DRAFT,
    });
  }

  async registerDriveImport(userId: string, input: RegisterDriveImportInput): Promise<MediaItem> {
    const driveUrl = `https://www.googleapis.com/drive/v3/files/${input.remoteFileId}?alt=media`;
    const resourceType = input.mimeType.startsWith('video/') ? 'video' : 'image';

    const { publicId, resource_type, thumbnailUrl, lightboxUrl } = await this.cloudinary.uploadFromUrl(
      driveUrl,
      { Authorization: `Bearer ${input.accessToken}` },
      `wave-atlas/users/${userId}`,
      resourceType,
    );

    try {
      return await this.media.createMedia({
        spotId: input.spotId,
        sessionId: input.sessionId,
        photographerId: userId,
        resource_type: resource_type as 'image' | 'video',
        cloudinaryPublicId: publicId,
        thumbnailUrl,
        lightboxUrl,
        capturedAt: new Date(),
        price: MIN_MEDIA_PRICE_CENTS,
        status: MEDIA_STATUS.DRAFT,
      });
    } catch (err) {
      this.cloudinary.deleteAsset(publicId, resource_type as 'image' | 'video').catch(
        (cleanupErr) => console.error('[MediaService] Failed to clean up orphaned Cloudinary asset', publicId, cleanupErr),
      );
      throw err;
    }
  }

  async updateMedia(userId: string, id: string, data: UpdateMediaInput): Promise<MediaItem> {
    await this.assertOwns(userId, id);
    return this.media.updateMedia(id, data);
  }

  async deleteMedia(userId: string, mediaId: string): Promise<void> {
    const media = await this.assertOwns(userId, mediaId);
    if (media.status === MEDIA_STATUS.DRAFT) {
      await this.media.hardDelete(mediaId);
      this.cloudinary.deleteAsset(
        media.cloudinaryPublicId,
        media.resource.resource_type as 'image' | 'video',
      ).catch((err) =>
        console.error('[MediaService] Failed to clean up Cloudinary asset after hardDelete', media.cloudinaryPublicId, err),
      );
    } else {
      await this.media.softDelete(mediaId);
    }
  }

  async updateBatch(userId: string, mediaIds: string[], data: UpdateBatchInput): Promise<void> {
    const items = await this.fetchOwnedBatch(userId, mediaIds);
    for (const item of items) {
      if (item.status !== MEDIA_STATUS.DRAFT) {
        throw new BadRequestError(`Media ${item.id} is not a draft`);
      }
    }
    await this.media.updateManyMedia(mediaIds, data);
  }

  async updatePublishedBatch(userId: string, mediaIds: string[], data: UpdateBatchInput): Promise<void> {
    assertPriceFloor(data.price);
    const items = await this.fetchOwnedBatch(userId, mediaIds);
    for (const item of items) {
      if (item.status !== MEDIA_STATUS.PUBLISHED) {
        throw new BadRequestError(`Media ${item.id} is not published`);
      }
    }
    await this.media.updateManyMedia(mediaIds, data);
  }

  async unpublishBatch(userId: string, mediaIds: string[]): Promise<void> {
    const items = await this.fetchOwnedBatch(userId, mediaIds);
    for (const item of items) {
      if (item.status !== MEDIA_STATUS.PUBLISHED) {
        throw new BadRequestError(`Media ${item.id} is not published`);
      }
    }
    await this.media.updateManyMedia(mediaIds, { status: MEDIA_STATUS.DRAFT });
  }

  async publish(
    userId: string,
    mediaIds: string[],
    data: UpdateBatchInput,
  ): Promise<void> {
    const items = await this.fetchOwnedBatch(userId, mediaIds);

    for (const item of items) {
      if (item.status !== MEDIA_STATUS.DRAFT) {
        throw new BadRequestError(`Media ${item.id} is not a draft`);
      }
      assertPriceFloor(data.price ?? item.price);
    }

    const updateData: { status: typeof MEDIA_STATUS.PUBLISHED; price?: number; capturedAt?: Date } = {
      status: MEDIA_STATUS.PUBLISHED,
    };
    if (data.price !== undefined) updateData.price = data.price;
    if (data.capturedAt) updateData.capturedAt = data.capturedAt;

    await this.media.updateManyMedia(mediaIds, updateData);
  }

  /**
   * Fetches all items in a single query, verifies each is owned by `userId`,
   * and returns the lightweight batch records. Replaces N individual findById
   * calls in batch operations.
   */
  async getSessionlessDrafts(userId: string, spotId: string): Promise<MediaItem[]> {
    return this.media.findSessionlessDraftsBySpot(userId, spotId);
  }

  private async fetchOwnedBatch(
    userId: string,
    mediaIds: string[],
  ): Promise<{ id: string; status: string; price: number; photographerId: string }[]> {
    const items = await this.media.findByIds(mediaIds);

    const found = new Set(items.map((i) => i.id));
    for (const id of mediaIds) {
      if (!found.has(id)) throw new NotFoundError('Media Item');
    }
    for (const item of items) {
      if (item.photographerId !== userId) {
        throw new ForbiddenError('You do not have permission to modify this media');
      }
    }
    return items;
  }

  private async assertOwns(userId: string, mediaId: string): Promise<MediaItem> {
    const media = await this.media.findById(mediaId);
    if (!media) throw new NotFoundError('Media Item');
    if (media.photographerId !== userId) {
      throw new ForbiddenError('You do not have permission to modify this media');
    }
    return media;
  }
}

export const mediaService = new MediaService(mediaRepository, cloudinaryService);
