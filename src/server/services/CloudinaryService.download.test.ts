import { beforeAll, describe, expect, it } from 'vitest';
import cloudinary from 'server/providers/cloudinary';
import { CloudinaryService } from 'server/services/CloudinaryService';

beforeAll(() => {
  process.env.CLOUDINARY_API_SECRET = 'test-secret';
  cloudinary.config({
    cloud_name: 'test-cloud',
    api_key: 'test-key',
    api_secret: 'test-secret',
    secure: true,
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
