import { SurfSessionStatus } from '@prisma/client';
import {
  surfSessionRepository,
  type CreateSurfSessionData,
  type ISurfSessionRepository,
} from 'server/repositories/SurfSessionRepository';
import { BadRequestError, ForbiddenError, NotFoundError } from 'shared/errors';

export type CreateSurfSessionInput = Omit<CreateSurfSessionData, 'photographerId'>;
export type CreateAndPublishInput = CreateSurfSessionInput & {
  mediaIds: string[];
  photoPrice: number;
  videoPrice: number;
};

export class SurfSessionService {
  constructor(private sessions: ISurfSessionRepository) {}

  create(photographerId: string, input: CreateSurfSessionInput) {
    return this.sessions.create({ ...input, photographerId });
  }

  async createAndPublish(photographerId: string, input: CreateAndPublishInput) {
    if (new Set(input.mediaIds).size !== input.mediaIds.length) {
      throw new BadRequestError('Duplicate media IDs are not allowed');
    }

    const mediaItems = await this.sessions.findPublishableDraftMedia(photographerId, input.mediaIds);
    if (mediaItems.length !== input.mediaIds.length) {
      throw new BadRequestError('One or more media items not found or already published');
    }

    return this.sessions.createAndPublish({
      spotId: input.spotId,
      photographerId,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      mediaItems,
      photoPrice: input.photoPrice,
      videoPrice: input.videoPrice,
    });
  }

  async publish(photographerId: string, sessionId: string) {
    const session = await this.sessions.findById(sessionId);
    if (!session) {
      throw new NotFoundError('Surf Session');
    }
    if (session.photographerId !== photographerId) {
      throw new ForbiddenError('You do not have permission to publish this session');
    }
    if (session.status !== SurfSessionStatus.DRAFT) {
      throw new BadRequestError('Only draft sessions can be published');
    }
    return this.sessions.publish(sessionId, photographerId);
  }
}

export const surfSessionService = new SurfSessionService(surfSessionRepository);
