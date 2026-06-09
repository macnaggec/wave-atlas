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

// Types
export type { UploadItem, QueueItem, UploadStatus, UploadItemAction, CloudinaryResult, ExifMetadata } from './types';
