import { describe, it, expect, vi } from 'vitest';
import { uploadToCloudinary } from 'features/Upload/model/cloudinaryTransport';
import { MEDIA_UPLOAD_LIMITS } from 'entities/Media/constants';

const baseParams = {
  signature: 'sig',
  timestamp: 1234567890,
  apiKey: 'key',
  cloudName: 'test-cloud',
  folder: 'wave-atlas/users/abc',
  eager: 't_wave_atlas_thumbnail,t_wave_atlas_lightbox_watermark',
};

function makeFile(name: string, size: number, mimeType: string): File {
  // File.size is read-only; use Object.defineProperty to override
  const file = new File([], name, { type: mimeType });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

describe('uploadToCloudinary — XHR lifecycle', () => {
  it('allows an image within the size limit', async () => {
    // XHR will not actually fire in jsdom; we just confirm no FILE_TOO_LARGE rejection
    const validImage = makeFile(
      'ok.jpg',
      MEDIA_UPLOAD_LIMITS.MAX_FILE_SIZE_IMAGE - 1,
      'image/jpeg',
    );

    const { promise, abort } = uploadToCloudinary({ ...baseParams, file: validImage });

    // Abort immediately so the dangling XHR doesn't keep the test hanging
    abort();

    await expect(promise).rejects.not.toMatchObject({ code: 'FILE_TOO_LARGE' });
  });

  it('starts XHR for a video within the size limit', async () => {
    const validVideo = makeFile(
      'ok.mp4',
      MEDIA_UPLOAD_LIMITS.MAX_FILE_SIZE_VIDEO - 1,
      'video/mp4',
    );

    const { promise, abort } = uploadToCloudinary({ ...baseParams, file: validVideo });

    abort();

    await expect(promise).rejects.not.toMatchObject({ code: 'FILE_TOO_LARGE' });
  });
});
