import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.VITE_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.VITE_CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export default cloudinary;

export function generateDeliveryUrl(
  cloudinaryPublicId: string,
  transform: string,
  resourceType: 'image' | 'video' = 'image',
  format?: string,
): string {
  return cloudinary.url(cloudinaryPublicId, {
    sign_url: true,
    type: 'authenticated',
    secure: true,
    raw_transformation: transform,
    resource_type: resourceType,
    ...(format ? { format } : {}),
  });
}

export const MEDIA_UPLOAD_CONFIG = {
  FOLDER: 'swelldays/raw',
} as const;

/**
 * Cloudinary Named Transformation identifiers.
 * Define these in Cloudinary dashboard:
 * Transformations → Named Transformations → Add
 *
 *  swelldays_thumbnail          → c_fill,w_400,h_300,q_auto,f_auto
 *  swelldays_lightbox_watermark → c_limit,w_800,q_auto,f_auto/l_watermark_xzn2p9,o_30,fl_tiled,fl_layer_apply
 *  swelldays_lightbox           → c_limit,w_800,q_auto,f_auto
 *
 * Named transformations are always permitted through Strict Transformations.
 */
export const MEDIA_CLOUDINARY_TRANSFORMS = {
  /** Gallery card: cropped thumbnail, no watermark */
  THUMBNAIL: 't_swelldays_thumbnail',
  /** Public-gallery lightbox: permanent signed URL to an authenticated asset, with tiled watermark */
  LIGHTBOX_WATERMARK: 't_swelldays_lightbox_watermark',
  /**
   * Full-quality lightbox: same sizing but no watermark.
   * Applied server-side only, after ownership check (purchased or own upload). Never exposed as a public URL.
   * Cloudinary dashboard: c_limit,w_800,q_auto,f_auto
   */
  LIGHTBOX: 't_swelldays_lightbox',
} as const;
