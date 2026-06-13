/**
 * MODEL LAYER - Business logic and state management
 *
 * Exports public API for Upload feature.
 * Following FSD (Feature-Sliced Design) architecture.
 */

// Main hooks
export { useUploadManager } from './useUploadManager';
export { useUploadQueue } from './useUploadQueue';
export { useUploadWarning } from './useUploadWarning';
export { useGooglePicker } from './useGooglePicker';
export { useDraftEditing } from './useDraftEditing';
export { useUploadStore } from './uploadStore';

// Types
export type { UploadItem, GalleryCard, UploadStatus, CloudinaryResult, ExifMetadata } from './types';
export { getItemId, isVideoItem, getMediaId } from './types';
