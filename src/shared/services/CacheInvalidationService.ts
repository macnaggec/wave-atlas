/**
 * CacheInvalidationService - Centralized Next.js cache revalidation
 *
 * Provides single source of truth for cache invalidation patterns.
 * Makes it easy to update caching strategy globally.
 */

import { revalidatePath } from 'next/cache';

export interface ICacheInvalidationService {
  invalidateMediaPaths(spotId?: string): void;
  invalidateSpotMedia(spotId: string): void;
  invalidateUserUploads(): void;
}

/**
 * Service for managing Next.js cache invalidation
 * Centralizes all revalidatePath calls for media-related operations
 */
export class CacheInvalidationService implements ICacheInvalidationService {
  /**
   * Invalidates all paths affected by media changes
   * @param spotId - Optional spot ID to invalidate specific spot page
   */
  invalidateMediaPaths(spotId?: string): void {
    if (spotId) {
      revalidatePath(`/spot/${spotId}`);
    }
    revalidatePath('/profile/uploads');
  }

  /**
   * Invalidates spot-specific media views
   * @param spotId - Spot ID whose media was modified
   */
  invalidateSpotMedia(spotId: string): void {
    revalidatePath(`/${spotId}`);
  }

  /**
   * Invalidates user upload views
   */
  invalidateUserUploads(): void {
    revalidatePath('/profile/uploads');
  }
}

/**
 * Singleton instance - reuse across server actions
 */
export const cacheService = new CacheInvalidationService();
