import { ForbiddenError, NotFoundError } from 'shared/errors';
import { findMediaById } from 'server/repositories/MediaRepository';
import { MediaItem as PrismaMediaItem } from '@prisma/client';

/**
 * Ensures the given user owns a media item.
 * Throws NotFoundError if the media doesn't exist.
 * Throws ForbiddenError if the user is not the photographer.
 * @returns The media item if authorized
 */
export async function ensureOwnsMedia(userId: string, mediaId: string): Promise<PrismaMediaItem> {
  const media = await findMediaById(mediaId);

  if (!media) {
    throw new NotFoundError('Media Item');
  }

  if (media.photographerId !== userId) {
    throw new ForbiddenError('You do not have permission to modify this media');
  }

  return media;
}
