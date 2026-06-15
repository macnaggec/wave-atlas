import { z } from 'zod';
import { MediaItem, mediaCloudinaryResultSchema } from 'entities/Media';

/**
 * Upload status lifecycle:
 * pending → signing → uploading → saving → completed
 *                                        ↘ error
 */
export type UploadStatus = 'pending' | 'signing' | 'uploading' | 'saving' | 'completed' | 'error' | 'importing' | 'cancelled';

/**
 * Zustand shape — owns upload-pipeline state only.
 * MediaItem data lives in TanStack Query, keyed by mediaId.
 * Never stores result/MediaItem directly to avoid dual-store inconsistency.
 */
export interface UploadItem {
  id: string;
  file: File | null;
  previewUrl: string;
  status: UploadStatus;
  progress: number;
  /** DB id of the saved MediaItem. Set on completion; undefined while uploading. */
  mediaId?: string;
  /** EXIF-derived capture time, stored after upload completes. */
  capturedAt?: Date;
  error?: string;
  cloudinaryResult?: CloudinaryResult;
  abortUpload?: () => void;
}

/**
 * Cloudinary upload response, derived from the shared validation schema.
 * Uses schema-inference to eliminate drift between the client type and the
 * server-validated shape (mediaCloudinaryResultSchema in entities/Media).
 */
export type CloudinaryResult = z.infer<typeof mediaCloudinaryResultSchema>;

/**
 * EXIF metadata extracted from uploaded file
 */
export interface ExifMetadata {
  capturedAt?: Date;
  source: 'exif' | 'manual' | 'none';
}

/**
 * Discriminated union for gallery cards.
 *
 * 'uploading' — item is (or was) in the upload pipeline. result is set once the
 *               DB row exists (status: 'completed').
 * 'draft'     — server-only draft: a MediaItem that was never in this pipeline
 *               session. Has no pipeline state.
 *
 * id is the item's logical gallery key:
 *   uploading → pipelineItem.mediaId ?? pipelineItem.id
 *   draft     → result.id
 */
export type GalleryCard =
  | { kind: 'uploading'; id: string; pipelineItem: UploadItem; result?: MediaItem }
  | { kind: 'draft';     id: string; result: MediaItem };

/** Stable gallery key — same as BaseGallery's default item.id. */
export function getItemId(card: GalleryCard): string {
  return card.id;
}

/** True if the card represents a video (checks Cloudinary result, then file MIME). */
export function isVideoItem(card: GalleryCard): boolean {
  if (card.kind === 'draft') return card.result.resource.resource_type === 'video';
  return (
    card.pipelineItem.cloudinaryResult?.resource_type === 'video' ||
    !!card.pipelineItem.file?.type.startsWith('video/')
  );
}

/**
 * Returns the DB media ID for the card, or undefined if the item has not yet
 * been saved to the database (upload still in-flight or in error without a DB row).
 */
export function getMediaId(card: GalleryCard): string | undefined {
  if (card.kind === 'draft') return card.result.id;
  if (card.pipelineItem.status === 'completed' && card.pipelineItem.mediaId) {
    return card.pipelineItem.mediaId;
  }
  return undefined;
}

export function isUploading(status: UploadStatus): boolean {
  return ['signing', 'uploading', 'saving'].includes(status);
}

export function revokeBlobUrl(url?: string): void {
  if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
}

export function isOrphanAsset(item: UploadItem): item is UploadItem & { cloudinaryResult: CloudinaryResult } {
  return item.status === 'error' && !!item.cloudinaryResult && !item.mediaId;
}
