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

/**
 * Cloudinary Named Transformation identifiers.
 * Define these in Cloudinary dashboard:
 * Transformations → Named Transformations → Add
 *
 *  wave_atlas_thumbnail          → c_fill,w_400,h_300,q_auto,f_auto
 *  wave_atlas_lightbox_watermark   → c_limit,w_800,q_auto,f_auto/l_watermark_xzn2p9,o_30,fl_tiled,fl_layer_apply
 *  wave_atlas_lightbox             → c_limit,w_800,q_auto,f_auto
 *
 * Named transformations are always permitted through Strict Transformations.
 */
export const MEDIA_CLOUDINARY_TRANSFORMS = {
  /** Gallery card: cropped thumbnail, no watermark */
  THUMBNAIL: 't_wave_atlas_thumbnail',
  /** Lightbox preview: width-limited with tiled watermark — public, unauthenticated */
  LIGHTBOX_WATERMARK: 't_wave_atlas_lightbox_watermark',
  /**
   * Full-quality lightbox: same sizing but no watermark.
   * Applied server-side only, after ownership check (purchased or own upload). Never exposed as a public URL.
   * Cloudinary dashboard: c_limit,w_800,q_auto,f_auto
   */
  LIGHTBOX: 't_wave_atlas_lightbox',
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
