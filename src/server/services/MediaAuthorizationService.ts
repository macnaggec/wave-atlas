/**
 * MediaAuthorizationService - Centralized authorization logic for media operations
 *
 * Encapsulates permission checks to eliminate duplication and enable testing.
 * Follows Single Responsibility Principle - only handles authorization decisions.
 */

import { ForbiddenError, NotFoundError } from 'shared/errors';
import { mediaRepository, IMediaRepository } from 'server/repositories/MediaRepository';
import { MediaItem as PrismaMediaItem } from '@prisma/client';

export interface IMediaAuthorizationService {
  ensureCanModify(userId: string, mediaId: string): Promise<PrismaMediaItem>;
  ensureCanDelete(userId: string, mediaId: string): Promise<PrismaMediaItem>;
}

/**
 * Authorization service for media operations
 * Verifies user permissions before allowing modifications
 */
export class MediaAuthorizationService implements IMediaAuthorizationService {
  constructor(private repository: IMediaRepository = mediaRepository) { }

  /**
   * Ensures user can modify media item (update price, status)
   * Throws NotFoundError if media doesn't exist
   * Throws ForbiddenError if user is not the photographer
   * @returns The media item if authorized
   */
  async ensureCanModify(userId: string, mediaId: string): Promise<PrismaMediaItem> {
    const media = await this.repository.findById(mediaId);

    if (!media) {
      throw new NotFoundError('Media Item');
    }

    if (media.photographerId !== userId) {
      throw new ForbiddenError('You do not have permission to update this media');
    }

    return media;
  }

  /**
   * Ensures user can delete media item
   * Throws NotFoundError if media doesn't exist
   * Throws ForbiddenError if user is not the photographer
   * @returns The media item if authorized
   */
  async ensureCanDelete(userId: string, mediaId: string): Promise<PrismaMediaItem> {
    const media = await this.repository.findById(mediaId);

    if (!media) {
      throw new NotFoundError('Media Item');
    }

    if (media.photographerId !== userId) {
      throw new ForbiddenError('You do not have permission to delete this media');
    }

    return media;
  }
}

/**
 * Singleton instance - reuse across server actions
 */
export const mediaAuthService = new MediaAuthorizationService();
