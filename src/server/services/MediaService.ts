import { MediaImportSource, MediaType } from '@prisma/client';
import type { IMediaRepository } from 'server/repositories/MediaRepository';
import { mediaRepository } from 'server/repositories/MediaRepository';
import { MEDIA_STATUS, MIN_MEDIA_PRICE_CENTS } from 'entities/Media/constants';
import type { MediaStatus } from 'entities/Media/constants';
import type { MediaItem } from 'entities/Media/types';
import { BadRequestError, ForbiddenError, InternalServerError, NotFoundError } from 'shared/errors';
import type { IMediaImportService } from 'server/services/MediaImportService';
import { mediaImportService } from 'server/services/MediaImportService';

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

export type RegisterDriveImportInput = {
  spotId: string;
  remoteFileId: string;
  mimeType: string;
  driveThumbnailUrl: string;
};

export class MediaService {
  constructor(
    private media: IMediaRepository,
    private importer: IMediaImportService,
  ) { }

  async createMedia(
    userId: string,
    input: CreateMediaInput
  ): Promise<MediaItem> {
    const resourceType = CLOUDINARY_TYPE_MAP[
      input.cloudinaryResult.resource_type.toLowerCase()
    ] ?? MediaType.PHOTO;

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

  async updateMedia(
    userId: string,
    id: string,
    data: UpdateMediaInput
  ): Promise<MediaItem> {
    await this.assertOwns(userId, id);

    return this.media.updateMedia(id, data);
  }

  async deleteMedia(userId: string, mediaId: string): Promise<void> {
    const media = await this.assertOwns(userId, mediaId);

    // DRIVE_PENDING items have no Cloudinary asset yet — treat like DRAFT (hard delete).
    if (media.status === MEDIA_STATUS.DRAFT || media.status === MEDIA_STATUS.DRIVE_PENDING) {
      await this.media.hardDelete(mediaId);
    } else {
      await this.media.softDelete(mediaId);
    }
  }

  async updateBatch(
    userId: string,
    mediaIds: string[],
    data: UpdateBatchInput
  ): Promise<MediaItem[]> {
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
      if (item.status !== MEDIA_STATUS.DRAFT && item.status !== MEDIA_STATUS.DRIVE_PENDING) {
        throw new BadRequestError(`Media ${item.id} cannot be published (status: ${item.status})`);
      }
      const finalPrice = data.price ?? item.price; // both in cents
      if (finalPrice < MIN_MEDIA_PRICE_CENTS) {
        throw new BadRequestError(`Price must be at least $${(MIN_MEDIA_PRICE_CENTS / 100).toFixed(2)}`);
      }
    }

    const baseUpdate: { price?: number; capturedAt?: Date } = {};
    if (data.price !== undefined) baseUpdate.price = data.price;
    if (data.capturedAt) baseUpdate.capturedAt = data.capturedAt;

    return Promise.all(
      items.map(async (item) => {
        if (item.importSource === MediaImportSource.GOOGLE_DRIVE) {
          return this.publishDriveItem(userId, item, baseUpdate);
        }
        return this.media.updateMedia(item.id, { ...baseUpdate, status: MEDIA_STATUS.PUBLISHED });
      }),
    );
  }

  private async publishDriveItem(
    userId: string,
    item: MediaItem,
    baseUpdate: { price?: number; capturedAt?: Date },
  ): Promise<MediaItem> {
    if (!item.remoteFileId) {
      throw new InternalServerError(`Drive item ${item.id} is missing remoteFileId`);
    }

    const folder = `wave-atlas/users/${userId}`;
    const { thumbnailUrl, lightboxUrl } = await this.importer.importFromRemote(
      MediaImportSource.GOOGLE_DRIVE,
      item.remoteFileId,
      folder,
    );

    return this.media.updateMedia(item.id, {
      ...baseUpdate,
      thumbnailUrl,
      lightboxUrl,
      status: MEDIA_STATUS.PUBLISHED,
    });
  }

  async registerDriveImport(
    userId: string,
    input: RegisterDriveImportInput
  ): Promise<MediaItem> {
    const type = input.mimeType.startsWith('video/')
      ? MediaType.VIDEO
      : MediaType.PHOTO;

    return this.media.createMedia({
      spotId: input.spotId,
      photographerId: userId,
      type,
      cloudinaryPublicId: '',
      thumbnailUrl: input.driveThumbnailUrl,
      lightboxUrl: input.driveThumbnailUrl,
      capturedAt: new Date(),
      price: MIN_MEDIA_PRICE_CENTS,
      status: MEDIA_STATUS.DRIVE_PENDING,
      importSource: MediaImportSource.GOOGLE_DRIVE,
      remoteFileId: input.remoteFileId,
    });
  }

  private async assertOwns(
    userId: string,
    mediaId: string
  ): Promise<MediaItem> {
    const media = await this.media.findById(mediaId);
    if (!media) throw new NotFoundError('Media Item');
    if (media.photographerId !== userId) {
      throw new ForbiddenError('You do not have permission to modify this media');
    }

    return media;
  }
}

export const mediaService = new MediaService(mediaRepository, mediaImportService);
