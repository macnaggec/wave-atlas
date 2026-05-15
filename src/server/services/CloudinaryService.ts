/**
 * CloudinaryService - Handles Cloudinary signature generation and configuration
 *
 * Encapsulates Cloudinary infrastructure logic to satisfy:
 * - Single Responsibility: Only handles Cloudinary operations
 * - Dependency Inversion: Server actions depend on this abstraction, not cloudinary SDK
 */

import cloudinary from 'server/lib/cloudinary';
import { InternalServerError } from 'shared/errors';
import { MEDIA_UPLOAD_CONFIG, MEDIA_CLOUDINARY_TRANSFORMS } from 'entities/Media/constants';

export interface CloudinarySignatureData {
  signature: string;
  timestamp: number;
  cloudName: string;
  apiKey: string;
  folder: string;
  /** Delivery type — must be forwarded in upload FormData exactly as-is */
  type: 'authenticated';
  /** Eager transform string — must be forwarded in upload FormData exactly as-is */
  eager: string;
}

export interface SignedMediaAccessResult {
  downloadUrl: string; // full-resolution download with fl_attachment — signed, expires in TTL
  expiresAt: number; // Unix timestamp for downloadUrl expiry
}

export interface RemoteUploadResult {
  publicId: string;
  resource_type: string;
  thumbnailUrl: string;
  lightboxUrl: string;
}

export interface ICloudinaryService {
  generateUploadSignature(folder?: string): CloudinarySignatureData;
  uploadFromUrl(sourceUrl: string, authHeaders: Record<string, string>, folder: string, resourceType?: 'image' | 'video'): Promise<RemoteUploadResult>;
  deleteAsset(publicId: string, resourceType?: 'image' | 'video'): Promise<void>;
  generateSignedDownload(cloudinaryPublicId: string): { downloadUrl: string; expiresAt: number };
  generatePermanentPreviewUrl(cloudinaryPublicId: string): string;
  tryGeneratePermanentPreviewUrl(cloudinaryPublicId: string): string | null;
}

/**
 * Service for Cloudinary upload signature generation
 * Validates configuration and creates signed upload parameters
 */
export class CloudinaryService implements ICloudinaryService {
  /**
   * Generates signed upload parameters for client-side Cloudinary uploads
   *
   * @param folder - Upload folder path (defaults to MEDIA_UPLOAD_CONFIG.FOLDER)
   * @returns Signature data needed for secure client-side upload
   * @throws InternalServerError if Cloudinary configuration is invalid
   */
  generateUploadSignature(folder: string = MEDIA_UPLOAD_CONFIG.FOLDER): CloudinarySignatureData {
    // Validate server-side secret
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    if (!apiSecret) {
      throw new InternalServerError(
        'Cloudinary misconfigured: missing CLOUDINARY_API_SECRET'
      );
    }

    // Validate public configuration
    const cloudName = process.env.VITE_CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.VITE_CLOUDINARY_API_KEY;

    if (!cloudName || !apiKey) {
      throw new InternalServerError(
        'Cloudinary misconfigured: missing VITE_CLOUDINARY_CLOUD_NAME or VITE_CLOUDINARY_API_KEY'
      );
    }

    const timestamp = Math.round(new Date().getTime() / 1000);

    // Eager transforms generate public-accessible variants at upload time:
    //   - thumbnail:         gallery card (small, no watermark, public)
    //   - lightbox_watermark: watermarked preview (medium, public)
    const eager = [
      MEDIA_CLOUDINARY_TRANSFORMS.THUMBNAIL,
      MEDIA_CLOUDINARY_TRANSFORMS.LIGHTBOX_WATERMARK,
    ].join('|');

    // All params that affect the upload MUST be signed to prevent tampering.
    const paramsToSign = {
      timestamp,
      folder,
      type: 'authenticated' as const,
      eager,
    };

    // Generate cryptographic signature
    const signature = cloudinary.utils.api_sign_request(
      paramsToSign,
      apiSecret
    );

    return {
      signature,
      timestamp,
      cloudName,
      apiKey,
      folder,
      type: 'authenticated' as const,
      eager,
    };
  }

  /**
   * Uploads a remote file to Cloudinary by fetching it server-side with the provided auth headers.
   * Applies the same eager transforms as client-side uploads (thumbnail + watermarked lightbox).
   *
   * Note: authHeaders may contain short-lived OAuth tokens — ensure log aggregators
   * are configured to scrub Authorization headers in production.
   */
  async uploadFromUrl(
    sourceUrl: string,
    authHeaders: Record<string, string>,
    folder: string,
    resourceType: 'image' | 'video' = 'image',
  ): Promise<RemoteUploadResult> {
    if (!process.env.CLOUDINARY_API_SECRET) {
      throw new InternalServerError('Cloudinary misconfigured: missing CLOUDINARY_API_SECRET');
    }

    const eager = [
      MEDIA_CLOUDINARY_TRANSFORMS.THUMBNAIL,
      MEDIA_CLOUDINARY_TRANSFORMS.LIGHTBOX_WATERMARK,
    ].join(',');

    const result = await cloudinary.uploader.upload(sourceUrl, {
      folder,
      type: 'authenticated',
      resource_type: resourceType,
      eager,
      headers: authHeaders,
    });

    return {
      publicId: result.public_id,
      resource_type: result.resource_type,
      thumbnailUrl: result.eager?.[0]?.secure_url ?? result.secure_url,
      lightboxUrl: result.eager?.[1]?.secure_url ?? result.secure_url,
    };
  }

  /**
   * Deletes an authenticated Cloudinary asset by public ID.
   * Used for cleanup when a DB write fails after a successful upload.
   */
  async deleteAsset(publicId: string, resourceType: 'image' | 'video' = 'image'): Promise<void> {
    await cloudinary.uploader.destroy(publicId, { type: 'authenticated', resource_type: resourceType });
  }

  /**
   * Generates a short-lived signed download URL for a purchased media file.
   * previewUrl (clean 800px) is stored as an eager transform URL in the DB and
   * returned directly by checkout.getSignedMediaAccess — no signing needed there.
   *
   * @param cloudinaryPublicId - The public_id of the authenticated Cloudinary resource
   */
  generateSignedDownload(cloudinaryPublicId: string): { downloadUrl: string; expiresAt: number } {
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    if (!apiSecret) {
      throw new InternalServerError('Cloudinary misconfigured: missing CLOUDINARY_API_SECRET');
    }

    const SIGNED_TTL = 600; // 10 minutes
    const expiresAt = Math.floor(Date.now() / 1000) + SIGNED_TTL;

    // Full original with fl_attachment to trigger browser download.
    const downloadUrl = cloudinary.url(cloudinaryPublicId, {
      sign_url: true,
      type: 'authenticated',
      expires_at: expiresAt,
      secure: true,
      flags: 'attachment',
    });

    return { downloadUrl, expiresAt };
  }

  /**
   * Generates a permanent signed URL for the full-quality (no watermark) preview.
   * Applies t_wave_atlas_lightbox_purchased to the authenticated original.
   * No TTL — the signature remains valid permanently. Only generated on purchase or for the owner.
   */
  generatePermanentPreviewUrl(cloudinaryPublicId: string): string {
    if (!cloudinaryPublicId) {
      throw new InternalServerError('cloudinaryPublicId is required to generate permanent preview URL');
    }
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    if (!apiSecret) {
      throw new InternalServerError('Cloudinary misconfigured: missing CLOUDINARY_API_SECRET');
    }

    return cloudinary.url(cloudinaryPublicId, {
      sign_url: true,
      type: 'authenticated',
      secure: true,
      raw_transformation: MEDIA_CLOUDINARY_TRANSFORMS.LIGHTBOX,
    });
  }

  /**
   * Best-effort variant of generatePermanentPreviewUrl.
   * Returns null and logs a warning instead of throwing.
   * Use in fulfillment flows where a Cloudinary failure must not block purchase creation.
   */
  tryGeneratePermanentPreviewUrl(cloudinaryPublicId: string): string | null {
    try {
      return this.generatePermanentPreviewUrl(cloudinaryPublicId);
    } catch (err) {
      console.warn('[CloudinaryService] Failed to generate permanent preview URL — purchase will have null previewUrl', err);
      return null;
    }
  }
}

/**
 * Singleton instance - reuse across server actions
 */
export const cloudinaryService = new CloudinaryService();
