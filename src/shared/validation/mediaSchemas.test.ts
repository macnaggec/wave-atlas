import { describe, expect, it } from 'vitest';
import { MIN_MEDIA_PRICE_CENTS } from 'shared/types/media';
import {
  mediaBatchUpdateSchema,
  mediaUpdateSchema,
} from 'shared/validation/mediaSchemas';

const mediaId = '11111111-1111-4111-8111-111111111111';

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
