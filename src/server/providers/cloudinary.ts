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
 *  swelldays_lightbox_watermark → c_limit,w_800,q_auto/l_watermark_jtm3mi/c_scale,fl_relative,w_0.25/o_30/fl_layer_apply,fl_tiled
 *  swelldays_lightbox           → c_limit,w_800,q_auto,f_auto
 *
 * Named transformations are always permitted through Strict Transformations.
 */
const VIDEO_WATERMARK_LAYER = 'l_watermark_jtm3mi/c_scale,fl_relative,w_0.25/o_45';
const VIDEO_WATERMARK_PLACEMENTS = [
  'g_north_west,x_30,y_30',
  'g_north,y_30',
  'g_north_east,x_30,y_30',
  'g_west,x_30',
  'g_center',
  'g_east,x_30',
  'g_south_west,x_30,y_30',
  'g_south,y_30',
  'g_south_east,x_30,y_30',
] as const;

export const MEDIA_CLOUDINARY_TRANSFORMS = {
  /** Gallery card: cropped thumbnail, no watermark */
  THUMBNAIL: 't_swelldays_thumbnail',
  /** Public image lightbox: permanent signed URL with Cloudinary's native tiled watermark */
  LIGHTBOX_WATERMARK: 't_swelldays_lightbox_watermark',
  /** Public video lightbox: explicit grid because Cloudinary's fl_tiled flag only supports image outputs */
  VIDEO_LIGHTBOX_WATERMARK: [
    'c_limit,w_800,q_auto',
    ...VIDEO_WATERMARK_PLACEMENTS.map(
      (placement) => `${VIDEO_WATERMARK_LAYER}/fl_layer_apply,${placement}`,
    ),
  ].join('/'),
  /**
   * Full-quality lightbox: same sizing but no watermark.
   * Applied server-side only, after ownership check (purchased or own upload). Never exposed as a public URL.
   * Cloudinary dashboard: c_limit,w_800,q_auto,f_auto
   */
  LIGHTBOX: 't_swelldays_lightbox',
} as const;

export function getWatermarkedPreviewTransform(resourceType: 'image' | 'video'): string {
  return resourceType === 'video'
    ? MEDIA_CLOUDINARY_TRANSFORMS.VIDEO_LIGHTBOX_WATERMARK
    : MEDIA_CLOUDINARY_TRANSFORMS.LIGHTBOX_WATERMARK;
}
