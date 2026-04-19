/**
 * ResourceTypeMapper - Extensible media type conversion
 *
 * Maps Cloudinary resource types to Prisma MediaType enum.
 * Follows Open/Closed Principle - easy to extend without modifying existing code.
 */

import { MediaType } from '@prisma/client';

export interface IResourceTypeMapper {
  mapToMediaType(cloudinaryType: string): MediaType;
}

/**
 * Mapper for converting Cloudinary resource types to application MediaType
 */
export class ResourceTypeMapper implements IResourceTypeMapper {
  private readonly typeMap: Record<string, MediaType> = {
    video: MediaType.VIDEO,
    image: MediaType.PHOTO,
  };

  /**
   * Maps Cloudinary resource_type to Prisma MediaType
   * @param cloudinaryType - Resource type from Cloudinary (e.g., 'video', 'image')
   * @returns Corresponding MediaType enum value
   */
  mapToMediaType(cloudinaryType: string): MediaType {
    const normalized = cloudinaryType.toLowerCase();
    return this.typeMap[normalized] || MediaType.PHOTO;
  }
}

/**
 * Singleton instance - reuse across server actions
 */
export const resourceTypeMapper = new ResourceTypeMapper();
