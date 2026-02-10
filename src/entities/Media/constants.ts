export const MEDIA_STATUS = {
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  DELETED: 'DELETED',
} as const;

// Legacy alias - will be removed after migration
export const PHOTO_STATUS = MEDIA_STATUS;

export const MEDIA_RESOURCE_TYPE = {
  IMAGE: 'image',
  VIDEO: 'video',
} as const;

export const MEDIA_UPLOAD_CONFIG = {
  FOLDER: 'wave-atlas/raw',
} as const;

export const MEDIA_UPLOAD_LIMITS = {
  // File size limits (bytes)
  MAX_FILE_SIZE_IMAGE: 10 * 1024 * 1024, // 10MB (Cloudinary free tier)
  MAX_FILE_SIZE_VIDEO: 50 * 1024 * 1024, // 50MB (conservative for bandwidth)

  // Batch limits
  MAX_FILES_PER_BATCH: 20, // UI performance + preview generation
  MAX_BATCH_SIZE: 200 * 1024 * 1024, // 200MB total per batch

  // Rate limiting (future implementation)
  MAX_UPLOADS_PER_DAY: 100, // Prevents abuse
} as const;

export type MediaStatus = typeof MEDIA_STATUS[keyof typeof MEDIA_STATUS];
export type PhotoStatus = MediaStatus; // Legacy alias
export type MediaResourceType = typeof MEDIA_RESOURCE_TYPE[keyof typeof MEDIA_RESOURCE_TYPE];
