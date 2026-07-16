import { beforeAll, describe, expect, it } from 'vitest';
import cloudinary from 'server/providers/cloudinary';
import { CloudinaryService } from 'server/services/CloudinaryService';

beforeAll(() => {
  process.env.CLOUDINARY_API_SECRET = 'test-secret';
  process.env.VITE_CLOUDINARY_CLOUD_NAME = 'test-cloud';
  process.env.VITE_CLOUDINARY_API_KEY = 'test-key';
  cloudinary.config({
    cloud_name: 'test-cloud',
    api_key: 'test-key',
    api_secret: 'test-secret',
    secure: true,
  });
});

describe('CloudinaryService.createUploadGrant', () => {
  it('applies a repeated SwellDays watermark grid to video previews', () => {
    const service = new CloudinaryService();

    const grant = service.createUploadGrant(
      {
        cloudinaryPublicId: 'swelldays/users/photographer/video-1',
        expectedMediaType: 'VIDEO',
        photographerId: 'photographer',
      },
      new Date('2026-07-15T22:00:00Z'),
    );
    const previewTransform = grant.eager.split('|')[1] ?? '';
    const countMatches = (pattern: RegExp) => previewTransform.match(pattern)?.length ?? 0;

    expect(countMatches(/l_watermark_jtm3mi/g)).toBe(9);
    expect(countMatches(/w_0\.25/g)).toBe(9);
    expect(countMatches(/o_45/g)).toBe(9);
    expect(previewTransform).not.toContain('fl_tiled');
    expect(previewTransform).not.toContain('wave_atlas');
  });
});

describe('CloudinaryService.generateSignedDownload', () => {
  it('uses Cloudinary video delivery for a purchased video', () => {
    const service = new CloudinaryService();

    const { downloadUrl } = service.generateSignedDownload(
      'swelldays/users/photographer/video-1',
      'video',
    );

    expect(new URL(downloadUrl).pathname).toContain('/video/authenticated/');
  });
});
