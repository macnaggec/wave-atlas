import { describe, expect, it } from 'vitest';
import { MIN_MEDIA_PRICE_CENTS } from 'shared/types/media';
import {
  mediaBatchUpdateSchema,
  mediaCreateSchema,
  mediaUpdateSchema,
} from 'shared/validation/mediaSchemas';

const mediaId = '11111111-1111-4111-8111-111111111111';

describe('mediaCreateSchema', () => {
  it('rejects an uploaded asset that is not assigned to a draft session', () => {
    const result = mediaCreateSchema.safeParse({
      cloudinaryResult: {
        publicId: 'wave-atlas/users/user-1/photo-1',
        thumbnailUrl: 'https://res.cloudinary.com/test/thumb.jpg',
        lightboxUrl: 'https://res.cloudinary.com/test/full.jpg',
        resourceType: 'image',
      },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path[0] === 'draftId')).toBe(true);
    }
  });
});

describe('mediaUpdateSchema', () => {
  it('rejects single-media prices below the media price floor', () => {
    const result = mediaUpdateSchema.safeParse({
      id: mediaId,
      price: MIN_MEDIA_PRICE_CENTS - 1,
    });

    expect(result.success).toBe(false);
  });
});

describe('mediaBatchUpdateSchema', () => {
  it('rejects batch prices below the media price floor', () => {
    const result = mediaBatchUpdateSchema.safeParse({
      mediaIds: [mediaId],
      price: MIN_MEDIA_PRICE_CENTS - 1,
    });

    expect(result.success).toBe(false);
  });
});
