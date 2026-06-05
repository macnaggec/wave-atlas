import { describe, it, expect } from 'vitest';
import { mediaCloudinaryResultSchema } from 'entities/Media/lib/mediaSchemas';

const BASE = 'https://res.cloudinary.com/test-cloud/';

const validBase = {
  publicId: 'wave-atlas/users/abc/img',
  thumbnailUrl: `${BASE}t_wave_atlas_thumbnail/wave-atlas/users/abc/img.jpg`,
  lightboxUrl: `${BASE}t_wave_atlas_lightbox_watermark/wave-atlas/users/abc/img.jpg`,
};

describe('mediaCloudinaryResultSchema — resource_type', () => {
  it('accepts "image"', () => {
    const result = mediaCloudinaryResultSchema.safeParse({ ...validBase, resource_type: 'image' });
    expect(result.success).toBe(true);
  });

  it('accepts "video"', () => {
    const result = mediaCloudinaryResultSchema.safeParse({ ...validBase, resource_type: 'video' });
    expect(result.success).toBe(true);
  });

  it('rejects arbitrary strings', () => {
    const result = mediaCloudinaryResultSchema.safeParse({ ...validBase, resource_type: 'raw' });
    expect(result.success).toBe(false);
  });

  it('rejects executable-looking values', () => {
    const result = mediaCloudinaryResultSchema.safeParse({ ...validBase, resource_type: 'script' });
    expect(result.success).toBe(false);
  });
});
