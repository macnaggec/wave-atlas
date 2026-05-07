import { MediaItem } from 'entities/Media/types';
import type { MediaResourceType } from 'entities/Media/constants';

/**
 * Upload status lifecycle:
 * pending → signing → uploading → saving → completed
 *                                        ↘ error
 */
export type UploadStatus = 'pending' | 'signing' | 'uploading' | 'saving' | 'completed' | 'error';

/**
 * Zustand shape — owns upload-pipeline state only.
 * MediaItem data lives in TanStack Query, keyed by mediaId.
 * Never stores result/MediaItem directly to avoid dual-store inconsistency.
 */
export interface UploadItem {
  id: string;
  spotId: string;
  file: File | null;
  previewUrl: string;
  status: UploadStatus;
  progress: number;
  /** DB id of the saved MediaItem. Set on completion; undefined while uploading. */
  mediaId?: string;
  error?: string;
  cloudinaryResult?: CloudinaryResult;
  abortUpload?: () => void;
}

/**
 * Unified queue shape returned by useUploadQueue.
 * Extends UploadItem with result joined from TanStack Query by mediaId.
 * Never stored in Zustand — derived at render time only.
 */
export interface QueueItem extends UploadItem {
  result?: MediaItem;
}

/**
 * Cloudinary upload response — shaped by the server-signed upload params.
 * eager[0] = thumbnail (public), eager[1] = lightbox (public, watermarked).
 * Original is authenticated — stored by publicId, never exposed raw.
 */
export interface CloudinaryResult {
  publicId: string;
  thumbnailUrl: string;
  lightboxUrl: string;
  resource_type: MediaResourceType;
}

/**
 * EXIF metadata extracted from uploaded file
 */
export interface ExifMetadata {
  capturedAt?: Date;
  source: 'exif' | 'manual' | 'none';
}
