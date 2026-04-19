/**
 * MODEL LAYER - Business logic and state management
 *
 * Exports public API for Upload feature.
 * Following FSD (Feature-Sliced Design) architecture.
 */

// Main hooks
export { useUploadManager } from './useUploadManager';
export { useUploadQueue } from './useUploadQueue';
export { useUploadBlocking } from './useUploadBlocking';
export { useUploadStatus } from './useUploadStatus';
export type { UploadStatusState } from './useUploadStatus';
export { useUploadWarning } from './useUploadWarning';
export { useDraftMedia, useDraftMediaMutate } from './useDraftMedia';
export { usePublish } from './usePublish';
export { useDraftEditing } from './useDraftEditing';
export { draftMediaKey } from './draftMediaKey';

// Types
export type { UploadItem, QueueItem, UploadStatus, CloudinaryResult, ExifMetadata } from './types';
