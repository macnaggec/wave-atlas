import { MediaImportSource } from '@prisma/client';
import { type UploadApiResponse } from 'cloudinary';
import cloudinaryInstance from 'server/lib/cloudinary';
import { BadGatewayError, InternalServerError } from 'shared/errors';
import { logger } from 'shared/lib/logger';
import { MEDIA_RESOURCE_TYPE, MEDIA_UPLOAD_EAGER_TRANSFORMS } from 'entities/Media/constants';

export interface DriveTransformResult {
  thumbnailUrl: string;
  lightboxUrl: string;
  resourceType: 'image' | 'video';
}

export interface IMediaImportService {
  importFromRemote(
    source: MediaImportSource,
    remoteFileId: string,
    folder: string
  ): Promise<DriveTransformResult>;
  /**
   * Uploads a remote file to Cloudinary for buyer download, signs a short-lived URL,
   * then immediately deletes the original. The file never persists in Cloudinary.
   */
  importForDownload(
    source: MediaImportSource,
    remoteFileId: string
  ): Promise<{ downloadUrl: string; expiresAt: number }>;
  verifyRemoteAvailability(
    source: MediaImportSource,
    remoteFileId: string
  ): Promise<boolean>;
}

// confirm=t bypasses Google's virus-scan interstitial for files > 25MB,
// which would otherwise return an HTML page instead of the file.
const GOOGLE_DRIVE_DOWNLOAD_BASE = 'https://drive.google.com/uc?export=download&confirm=t';

// Matches the XHR pipeline timeout in cloudinaryTransport.ts.
const CLOUDINARY_UPLOAD_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export class MediaImportService implements IMediaImportService {
  /**
   * Fetches a remote file into Cloudinary, generates eager transforms, then
   * immediately deletes the original to avoid long-term storage costs.
   * Only thumbnail and lightbox transforms remain in Cloudinary.
   *
   * NOTE: Does not return a publicId — the original is deleted after transforms are
   * generated and cannot be used for signed downloads. Re-fetch from the remote source
   * is required at purchase time via a separate importFromRemote call.
   */
  async importFromRemote(
    source: MediaImportSource,
    remoteFileId: string,
    folder: string,
  ): Promise<DriveTransformResult> {
    const remoteUrl = this.buildRemoteUrl(source, remoteFileId);

    let uploadResult: UploadApiResponse;

    try {
      uploadResult = await cloudinaryInstance.uploader.upload(remoteUrl, {
        folder,
        type: 'authenticated',
        eager: MEDIA_UPLOAD_EAGER_TRANSFORMS,
        resource_type: 'auto',
        timeout: CLOUDINARY_UPLOAD_TIMEOUT_MS,
      });
    } catch (err) {
      logger.error('[MediaImportService] Cloudinary URL upload failed', { source, remoteFileId, err });
      throw new BadGatewayError('Failed to import media from remote source');
    }

    const thumbnailUrl = uploadResult.eager?.[0]?.secure_url;
    const lightboxUrl = uploadResult.eager?.[1]?.secure_url;

    if (!thumbnailUrl || !lightboxUrl) {
      logger.error('[MediaImportService] Cloudinary eager transforms missing', { publicId: uploadResult.public_id });
      throw new InternalServerError('Cloudinary upload succeeded but transforms are missing');
    }

    const resourceType = uploadResult.resource_type === MEDIA_RESOURCE_TYPE.VIDEO
      ? MEDIA_RESOURCE_TYPE.VIDEO
      : MEDIA_RESOURCE_TYPE.IMAGE;

    // Delete original immediately — transforms are kept by default (Cloudinary derived assets
    // are not removed when the original is destroyed). Only original storage is freed.
    try {
      await cloudinaryInstance.uploader.destroy(uploadResult.public_id, {
        type: 'authenticated',
        invalidate: true,
        resource_type: uploadResult.resource_type,
      });
    } catch (err) {
      // Non-fatal: transforms are already generated. Log and continue.
      logger.warn('[MediaImportService] Failed to delete original after import — transforms still valid', {
        publicId: uploadResult.public_id,
        err,
      });
    }

    return { thumbnailUrl, lightboxUrl, resourceType };
  }

  /**
   * Uploads a remote file to Cloudinary for buyer download, signs a short-lived URL,
   * then immediately deletes the original to avoid storage costs.
   *
   * The file is uploaded to a temporary folder and deleted after the signed URL is captured.
   * Signed TTL matches CloudinaryService.generateSignedDownload (10 minutes).
   */
  async importForDownload(
    source: MediaImportSource,
    remoteFileId: string,
  ): Promise<{ downloadUrl: string; expiresAt: number }> {
    const remoteUrl = this.buildRemoteUrl(source, remoteFileId);

    let uploadResult: UploadApiResponse;

    try {
      uploadResult = await cloudinaryInstance.uploader.upload(remoteUrl, {
        folder: 'wave-atlas/drive/temp',
        type: 'authenticated',
        resource_type: 'auto',
        timeout: CLOUDINARY_UPLOAD_TIMEOUT_MS,
      });
    } catch (err) {
      logger.error('[MediaImportService] Cloudinary upload for download failed', { source, remoteFileId, err });
      throw new BadGatewayError('Failed to fetch media from remote source for download');
    }

    const SIGNED_TTL = 600; // 10 minutes
    const expiresAt = Math.floor(Date.now() / 1000) + SIGNED_TTL;

    const downloadUrl = cloudinaryInstance.url(uploadResult.public_id, {
      sign_url: true,
      type: 'authenticated',
      expires_at: expiresAt,
      secure: true,
      flags: 'attachment',
      resource_type: uploadResult.resource_type,
    });

    // Delete immediately — the signed URL is already captured.
    try {
      await cloudinaryInstance.uploader.destroy(uploadResult.public_id, {
        type: 'authenticated',
        invalidate: true,
        resource_type: uploadResult.resource_type,
      });
    } catch (err) {
      // Non-fatal: buyer can still download. Log for manual cleanup.
      logger.warn('[MediaImportService] Failed to delete Drive temp upload after download', {
        publicId: uploadResult.public_id,
        err,
      });
    }

    return { downloadUrl, expiresAt };
  }

  /**
   * Performs a lightweight availability check on the remote file before charging a buyer.
   * Returns false if the file is gone, inaccessible, or the link has expired.
   * Caller should abort checkout if this returns false.
   *
   * Google Drive returns HTTP 200 with a `text/html` interstitial when access is denied
   * or the file has been moved. We detect this by asserting the response Content-Type is
   * not HTML — a real media file always returns a non-HTML MIME type.
   */
  async verifyRemoteAvailability(
    source: MediaImportSource,
    remoteFileId: string
  ): Promise<boolean> {
    const remoteUrl = this.buildRemoteUrl(source, remoteFileId);
    try {
      const response = await fetch(remoteUrl, { method: 'HEAD' });
      if (!response.ok) return false;

      const contentType = response.headers.get('content-type') ?? '';
      return !contentType.startsWith('text/html');
    } catch {
      return false;
    }
  }

  /**
   * Builds the fetchable URL for a remote file by provider.
   * Add new providers here — all other code stays unchanged.
   */
  private buildRemoteUrl(source: MediaImportSource, remoteFileId: string): string {
    switch (source) {
      case MediaImportSource.GOOGLE_DRIVE:
        return `${GOOGLE_DRIVE_DOWNLOAD_BASE}&id=${encodeURIComponent(remoteFileId)}`;
      case MediaImportSource.DIRECT:
        throw new InternalServerError('DIRECT import source does not use remote URL fetching');
      default: {
        const _exhaustive: never = source;
        throw new InternalServerError(`Unsupported import source: ${_exhaustive}`);
      }
    }
  }
}

export const mediaImportService = new MediaImportService();
