import { MediaType } from '@prisma/client';
import type { IMediaRepository } from 'server/repositories/MediaRepository';
import { mediaRepository } from 'server/repositories/MediaRepository';
import { MEDIA_STATUS, MIN_MEDIA_PRICE_CENTS } from 'entities/Media/constants';
import type { MediaStatus } from 'entities/Media/constants';
import type { MediaItem } from 'entities/Media/types';
import { BadRequestError, ForbiddenError, NotFoundError } from 'shared/errors';

const CLOUDINARY_TYPE_MAP: Record<string, MediaType> = {
  video: MediaType.VIDEO,
  image: MediaType.PHOTO,
};

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

export type PublishInput = {
  price?: number;
  capturedAt?: Date;
};

export class MediaService {
  constructor(private media: IMediaRepository) { }

  async createMedia(userId: string, input: CreateMediaInput): Promise<MediaItem> {
    const resourceType = CLOUDINARY_TYPE_MAP[input.cloudinaryResult.resource_type.toLowerCase()] ?? MediaType.PHOTO;
    return this.media.createMedia({
      spotId: input.spotId,
      photographerId: userId,
      type: resourceType,
      cloudinaryPublicId: input.cloudinaryResult.publicId,
      thumbnailUrl: input.cloudinaryResult.thumbnailUrl,
      lightboxUrl: input.cloudinaryResult.lightboxUrl,
      capturedAt: input.capturedAt ?? new Date(),
      price: input.price ?? MIN_MEDIA_PRICE_CENTS,
      status: MEDIA_STATUS.DRAFT,
    });
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
    data: PublishInput
  ): Promise<MediaItem[]> {
    const items = await Promise.all(mediaIds.map((id) => this.assertOwns(userId, id)));

    for (const item of items) {
      if (item.status !== MEDIA_STATUS.DRAFT) {
        throw new BadRequestError(`Media ${item.id} is not a draft`);
      }
      const finalPrice = data.price ?? item.price; // both in cents
      if (finalPrice < MIN_MEDIA_PRICE_CENTS) {
        throw new BadRequestError(`Price must be at least $${(MIN_MEDIA_PRICE_CENTS / 100).toFixed(2)}`);
      }
    }

    const updateData: {
      status: typeof MEDIA_STATUS.PUBLISHED;
      price?: number;
      capturedAt?: Date
    } = {
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

export const mediaService = new MediaService(mediaRepository);
