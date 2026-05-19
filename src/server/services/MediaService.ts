import type { IMediaRepository } from 'server/repositories/MediaRepository';
import { mediaRepository } from 'server/repositories/MediaRepository';
import { MEDIA_STATUS, MIN_MEDIA_PRICE_CENTS } from 'entities/Media/constants';
import type { MediaStatus } from 'entities/Media/constants';
import type { MediaItem } from 'entities/Media/types';
import { BadRequestError, ForbiddenError, NotFoundError } from 'shared/errors';
import type { ICloudinaryService } from './CloudinaryService';
import { cloudinaryService } from './CloudinaryService';

const CLOUDINARY_USER_FOLDER = 'wave-atlas/users' as const;

export type CreateMediaInput = {
  spotId: string;
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
};

export type RegisterDriveImportInput = {
  spotId: string;
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
    return this.cloudinary.generateUploadSignature(`${CLOUDINARY_USER_FOLDER}/${userId}`);
  }

  async createMedia(userId: string, input: CreateMediaInput): Promise<MediaItem> {
    const { publicId, resource_type } = input.cloudinaryResult;
    try {
      return await this.media.createMedia({
        spotId: input.spotId,
        photographerId: userId,
        resource_type: resource_type as 'image' | 'video',
        cloudinaryPublicId: publicId,
        thumbnailUrl: input.cloudinaryResult.thumbnailUrl,
        lightboxUrl: input.cloudinaryResult.lightboxUrl,
        capturedAt: input.capturedAt ?? new Date(),
        price: input.price ?? MIN_MEDIA_PRICE_CENTS,
        status: MEDIA_STATUS.DRAFT,
      });
    } catch (err) {
      this.cloudinary.deleteAsset(publicId, resource_type as 'image' | 'video').catch(
        (cleanupErr) => console.error('[MediaService] Failed to clean up orphaned Cloudinary asset', publicId, cleanupErr),
      );
      throw err;
    }
  }

  async registerDriveImport(userId: string, input: RegisterDriveImportInput): Promise<MediaItem> {
    const driveUrl = `https://www.googleapis.com/drive/v3/files/${input.remoteFileId}?alt=media`;
    const resourceType = input.mimeType.startsWith('video/') ? 'video' : 'image';

    console.log('[MediaService] Drive import start', { userId, spotId: input.spotId, remoteFileId: input.remoteFileId, mimeType: input.mimeType });

    let uploadResult: Awaited<ReturnType<typeof this.cloudinary.uploadFromUrl>>;
    try {
      uploadResult = await this.cloudinary.uploadFromUrl(
        driveUrl,
        { Authorization: `Bearer ${input.accessToken}` },
        `${CLOUDINARY_USER_FOLDER}/${userId}`,
        resourceType,
      );
    } catch (err) {
      console.error('[MediaService] Drive import: Cloudinary upload failed', { userId, spotId: input.spotId, remoteFileId: input.remoteFileId }, err);
      throw err;
    }

    const { publicId, resource_type, thumbnailUrl, lightboxUrl } = uploadResult;

    try {
      return await this.media.createMedia({
        spotId: input.spotId,
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
    } else {
      await this.media.softDelete(mediaId);
    }
  }

  async updateBatch(userId: string, mediaIds: string[], data: UpdateBatchInput): Promise<MediaItem[]> {
    await Promise.all(
      mediaIds.map(async (id) => {
        const item = await this.assertOwns(userId, id);
        if (item.status !== MEDIA_STATUS.DRAFT) {
          throw new BadRequestError(`Media ${id} is not a draft`);
        }
      }),
    );
    return Promise.all(mediaIds.map((id) => this.media.updateMedia(id, data)));
  }

  async publish(
    userId: string,
    mediaIds: string[],
    data: UpdateBatchInput,
  ): Promise<MediaItem[]> {
    const items = await Promise.all(mediaIds.map((id) => this.assertOwns(userId, id)));

    for (const item of items) {
      if (item.status !== MEDIA_STATUS.DRAFT) {
        throw new BadRequestError(`Media ${item.id} is not a draft`);
      }
      const finalPrice = data.price ?? item.price;
      if (finalPrice < MIN_MEDIA_PRICE_CENTS) {
        throw new BadRequestError(`Price must be at least $${(MIN_MEDIA_PRICE_CENTS / 100).toFixed(2)}`);
      }
    }

    const updateData: { status: typeof MEDIA_STATUS.PUBLISHED; price?: number; capturedAt?: Date } = {
      status: MEDIA_STATUS.PUBLISHED,
    };
    if (data.price !== undefined) updateData.price = data.price;
    if (data.capturedAt) updateData.capturedAt = data.capturedAt;

    return Promise.all(mediaIds.map((id) => this.media.updateMedia(id, updateData)));
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
