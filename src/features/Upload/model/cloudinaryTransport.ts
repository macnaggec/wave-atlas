import { logger } from 'shared/lib/logger';
import { UploadError } from './UploadError';
import type { CloudinaryResult } from './types';

/**
 * Client-side Cloudinary Upload Transport
 * Handles the actual XHR upload to Cloudinary using the server-generated signature.
 */

interface CloudinaryUploadParams {
  file: File;
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  folder: string;
  /** Delivery type — must match the signed param */
  type: 'authenticated';
  /** Eager transform string — must match the signed param */
  eager: string;
  onProgress?: (progress: number) => void;
}

/** Raw Cloudinary HTTP response — internal to this module only */
interface RawCloudinaryResponse {
  public_id: string;
  resource_type: string;
  eager?: Array<{ secure_url: string }>;
}

export interface CloudinaryUpload {
  promise: Promise<CloudinaryResult>;
  abort: () => void;
}

export const uploadToCloudinary = (params: CloudinaryUploadParams): CloudinaryUpload => {
  const { cloudName, onProgress } = params;

  const xhr = new XMLHttpRequest();
  const abort = () => xhr.abort();

  const promise = new Promise<CloudinaryResult>((resolve, reject) => {
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, true);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        return parseSuccessResponse(xhr.responseText, resolve, reject);
      }
      if (xhr.status >= 400 && xhr.status < 500) {
        return reject(parseRejectedResponse(xhr));
      }
      reject(new UploadError('CLOUDINARY_UNAVAILABLE', `Cloudinary error: ${xhr.statusText}`));
    };

    xhr.onerror = () => reject(new UploadError('NETWORK_ERROR', 'Network error during upload'));
    xhr.onabort = () => reject(new Error('Upload cancelled'));

    xhr.send(buildFormData(params));
  });

  return { promise, abort };
};

function buildFormData(params: CloudinaryUploadParams): FormData {
  const formData = new FormData();
  formData.append('file', params.file);
  formData.append('api_key', params.apiKey);
  formData.append('timestamp', params.timestamp.toString());
  formData.append('signature', params.signature);
  formData.append('folder', params.folder);
  formData.append('type', params.type);
  formData.append('eager', params.eager);

  return formData;
}

function parseSuccessResponse(
  responseText: string,
  resolve: (result: CloudinaryResult) => void,
  reject: (error: UploadError) => void,
): void {
  let raw: RawCloudinaryResponse;
  try {
    raw = JSON.parse(responseText);
  } catch {
    reject(new UploadError('INVALID_RESPONSE', 'Invalid JSON response from Cloudinary'));

    return;
  }

  const eager = raw.eager ?? [];
  const thumbnailUrl = eager[0]?.secure_url;
  const lightboxUrl = eager[1]?.secure_url;

  if (!thumbnailUrl || !lightboxUrl) {
    reject(new UploadError(
      'INVALID_RESPONSE',
      'Cloudinary response missing eager transform URLs — check named transform configuration',
    ));

    return;
  }

  resolve({
    publicId: raw.public_id,
    resource_type: raw.resource_type,
    thumbnailUrl,
    lightboxUrl
  });
}

function parseRejectedResponse(xhr: XMLHttpRequest): UploadError {
  let message = `Cloudinary upload failed: ${xhr.statusText}`;
  try {
    const parsed = JSON.parse(xhr.responseText);
    if (parsed.error?.message) message = parsed.error.message;
  } catch {
    logger.warn('[cloudinaryTransport] Non-JSON response from Cloudinary', {
      status: xhr.status,
      body: xhr.responseText,
    });
  }

  return new UploadError('CLOUDINARY_REJECTED', message);
}
