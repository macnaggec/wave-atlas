/**
 * CloudinaryService - Handles Cloudinary signature generation and configuration
 *
 * Encapsulates Cloudinary infrastructure logic to satisfy:
 * - Single Responsibility: Only handles Cloudinary operations
 * - Dependency Inversion: Server actions depend on this abstraction, not cloudinary SDK
 */

import cloudinary from 'shared/lib/cloudinary';
import { InternalServerError } from 'shared/errors';
import { MEDIA_UPLOAD_CONFIG } from 'entities/Media/constants';

export interface CloudinarySignatureData {
  signature: string;
  timestamp: number;
  cloudName: string;
  apiKey: string;
  folder: string;
}

export interface ICloudinaryService {
  generateUploadSignature(folder?: string): CloudinarySignatureData;
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
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY;

    if (!cloudName || !apiKey) {
      throw new InternalServerError(
        'Cloudinary misconfigured: missing NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME or NEXT_PUBLIC_CLOUDINARY_API_KEY'
      );
    }

    const timestamp = Math.round(new Date().getTime() / 1000);

    // Params to sign for secure upload
    const paramsToSign = {
      timestamp,
      folder,
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
    };
  }
}

/**
 * Singleton instance - reuse across server actions
 */
export const cloudinaryService = new CloudinaryService();
