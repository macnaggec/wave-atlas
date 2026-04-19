/**
 * One-time setup script: creates Named Transformations in Cloudinary via API.
 * These are required for Strict Transformations to allow our transform URLs.
 *
 * Run once:
 *   node scripts/setup-cloudinary-transforms.mjs
 */

import { v2 as cloudinary } from 'cloudinary';
import 'dotenv/config';

cloudinary.config({
  cloud_name: process.env.VITE_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.VITE_CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const TRANSFORMS = [
  {
    name: 'wave_atlas_thumbnail',
    transformation: 'c_fill,w_400,h_300,q_auto,f_auto',
  },
  {
    name: 'wave_atlas_lightbox',
    // Two chained groups: resize first, then apply tiled watermark overlay
    transformation: 'c_limit,w_800,q_auto,f_auto/l_watermark_xzn2p9,o_30,fl_tiled,fl_layer_apply',
  },
];

for (const { name, transformation } of TRANSFORMS) {
  try {
    await cloudinary.api.create_transformation(name, { transformation });
    console.log(`✓ Created: ${name}`);
  } catch (err) {
    if (err?.error?.message?.includes('already exists')) {
      console.log(`– Already exists: ${name}`);
    } else {
      console.error(`✗ Failed: ${name}`, err?.error?.message ?? err);
    }
  }
}
