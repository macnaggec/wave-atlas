'use client';

import {
  BadRequestError,
  BadGatewayError,
  InternalServerError,
  ServiceUnavailableError,
} from 'shared/errors';

/**
 * Client-side Cloudinary Upload Service
 * Handles the actual XHR upload to Cloudinary using the server-generated signature.
 */

// Helper to construct the API URL
const getCloudinaryUrl = (cloudName: string) =>
  `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`;

interface CloudinaryUploadParams {
  file: File;
  signature: string;
  timestamp: number;
  // Optional if set in environment variables
  apiKey?: string;
  cloudName?: string;
  folder: string;
  onProgress?: (progress: number) => void;
}

export interface CloudinaryUploadResult {
  public_id: string;
  version: number;
  signature: string;
  width: number;
  height: number;
  format: string;
  resource_type: string;
  created_at: string;
  bytes: number;
  url: string;
  secure_url: string;
  original_filename: string;
}

export const uploadToCloudinary = async ({
  file,
  signature,
  timestamp,
  apiKey,
  cloudName,
  folder,
  onProgress,
}: CloudinaryUploadParams): Promise<CloudinaryUploadResult> => {
  const actualApiKey = apiKey || process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY;
  const actualCloudName =
    cloudName || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

  if (!actualApiKey || !actualCloudName) {
    throw new InternalServerError(
      'Cloudinary configuration missing (apiKey or cloudName)'
    );
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('api_key', actualApiKey);
  formData.append('timestamp', timestamp.toString());
  formData.append('signature', signature);
  formData.append('folder', folder);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const url = getCloudinaryUrl(actualCloudName);

    xhr.open('POST', url, true);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        const progress = Math.round((e.loaded / e.total) * 100);
        onProgress(progress);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          resolve(response);
        } catch (err) {
          reject(
            new InternalServerError('Invalid JSON response from Cloudinary', {
              originalError: err,
            })
          );
        }
      } else if (xhr.status >= 400 && xhr.status < 500) {
        let message = `Cloudinary upload failed: ${xhr.statusText}`;
        let details: unknown = xhr.responseText;

        try {
          const parsed = JSON.parse(xhr.responseText);
          if (parsed.error?.message) {
            message = parsed.error.message;
          }
          details = parsed;
        } catch (e) {
          // Response was not JSON, use default message
        }

        reject(new BadRequestError(message, details));
      } else {
        reject(
          new BadGatewayError(`Cloudinary error: ${xhr.statusText}`, {
            status: xhr.status,
          })
        );
      }
    };

    xhr.onerror = () => {
      reject(new ServiceUnavailableError('Network error during upload'));
    };

    xhr.send(formData);
  });
};
