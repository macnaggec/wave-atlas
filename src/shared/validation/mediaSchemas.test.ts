import { describe, it, expect } from 'vitest';
import {
  mediaCloudinaryResultSchema,
  mediaBatchUpdateSchema,
  mediaPublishSchema,
} from 'shared/validation/mediaSchemas';

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

const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000';

describe('mediaBatchUpdateSchema — price minimum', () => {
  it('rejects price below $3 (2.99 dollars)', () => {
    const result = mediaBatchUpdateSchema.safeParse({ mediaIds: [VALID_UUID], price: 2.99 });
    expect(result.success).toBe(false);
  });

  it('rejects price of 0 (free)', () => {
    const result = mediaBatchUpdateSchema.safeParse({ mediaIds: [VALID_UUID], price: 0 });
    expect(result.success).toBe(false);
  });

  it('accepts price of exactly $3 (3 dollars)', () => {
    const result = mediaBatchUpdateSchema.safeParse({ mediaIds: [VALID_UUID], price: 3 });
    expect(result.success).toBe(true);
  });
});

describe('mediaPublishSchema — price minimum', () => {
  it('rejects price below $3 (2.99 dollars)', () => {
    const result = mediaPublishSchema.safeParse({ mediaIds: [VALID_UUID], price: 2.99 });
    expect(result.success).toBe(false);
  });

  it('rejects price of 0 (free)', () => {
    const result = mediaPublishSchema.safeParse({ mediaIds: [VALID_UUID], price: 0 });
    expect(result.success).toBe(false);
  });

  it('accepts price of exactly $3 (3 dollars)', () => {
    const result = mediaPublishSchema.safeParse({ mediaIds: [VALID_UUID], price: 3 });
    expect(result.success).toBe(true);
  });
});
