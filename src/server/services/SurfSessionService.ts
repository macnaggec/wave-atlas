import { SurfSessionStatus } from '@prisma/client';
import {
  surfSessionRepository,
  type CreateSurfSessionData,
  type ISurfSessionRepository,
  type UpdateSurfSessionDraftData,
} from 'server/repositories/SurfSessionRepository';
import { uploadAttemptRepository, type IUploadAttemptRepository } from 'server/repositories/UploadAttemptRepository';
import { BadRequestError, ForbiddenError, NotFoundError } from 'shared/errors';

export type CreateSurfSessionInput = Omit<CreateSurfSessionData, 'photographerId'>;
export type UpdateSurfSessionDraftInput = UpdateSurfSessionDraftData;

export class SurfSessionService {
  constructor(
    private sessions: ISurfSessionRepository,
    private attempts: Pick<IUploadAttemptRepository, 'hasBlockingAttempts'> = uploadAttemptRepository,
  ) {}

  create(photographerId: string, input: CreateSurfSessionInput) {
    return this.sessions.getOrCreateActiveDraft({ ...input, photographerId });
  }

  async getDraft(photographerId: string, sessionId: string) {
    const session = await this.sessions.findDraftById(sessionId);
    if (!session) throw new NotFoundError('Surf Session');
    if (session.photographerId !== photographerId) {
      throw new ForbiddenError('You do not have permission to view this session');
    }
    if (session.status !== SurfSessionStatus.DRAFT) {
      throw new BadRequestError('Session is not a draft');
    }
    return session;
  }

  async updateDraft(
    photographerId: string,
    sessionId: string,
    input: UpdateSurfSessionDraftInput,
  ) {
    const session = await this.sessions.findDraftById(sessionId);
    if (!session) {
      throw new NotFoundError('Surf Session');
    }
    if (session.photographerId !== photographerId) {
      throw new ForbiddenError('You do not have permission to edit this session');
    }
    if (session.status !== SurfSessionStatus.DRAFT) {
      throw new BadRequestError('Only draft sessions can be edited');
    }

    const startsAt = input.startsAt === undefined ? session.startsAt : input.startsAt;
    const endsAt = input.endsAt === undefined ? session.endsAt : input.endsAt;
    if (startsAt && endsAt && startsAt >= endsAt) {
      throw new BadRequestError('Session end time must be after its start time');
    }

    return this.sessions.updateDraft(sessionId, photographerId, input);
  }

  async publish(photographerId: string, sessionId: string) {
    const session = await this.sessions.findDraftById(sessionId);
    if (!session) {
      throw new NotFoundError('Surf Session');
    }
    if (session.photographerId !== photographerId) {
      throw new ForbiddenError('You do not have permission to publish this session');
    }
    if (session.status !== SurfSessionStatus.DRAFT) {
      throw new BadRequestError('Only draft sessions can be published');
    }
    const draft = session as typeof session & {
      photoPrice?: number | null;
      videoPrice?: number | null;
    };
    if (
      !draft.spotId ||
      !draft.startsAt ||
      !draft.endsAt ||
      draft.photoPrice == null ||
      draft.videoPrice == null
    ) {
      throw new BadRequestError('Draft session is incomplete');
    }
    if (draft.startsAt >= draft.endsAt) {
      throw new BadRequestError('Session end time must be after its start time');
    }
    const hasBlocking = await this.attempts.hasBlockingAttempts(sessionId);
    if (hasBlocking) {
      throw new BadRequestError('Cannot publish while there are active or failed upload attempts. Resolve or discard them first.');
    }
    return this.sessions.publish(sessionId, photographerId);
  }
}

export const surfSessionService = new SurfSessionService(surfSessionRepository);
