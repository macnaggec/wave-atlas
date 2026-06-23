/**
 * MODEL LAYER - Business logic and state management
 *
 * Exports public API for Upload feature.
 * Following FSD (Feature-Sliced Design) architecture.
 */

// Main hooks
export { useUploadManager } from './useUploadManager';
export { useClearUploadQueue } from './useClearUploadQueue';
export { useUploadQueue } from './useUploadQueue';
export { useUploadWarning } from './useUploadWarning';
export { useGooglePicker } from './useGooglePicker';
export { usePublishUploadSession } from './usePublishUploadSession';
export { useUploadStore } from './uploadStore';
export { getPublishableMediaIds, getSelectableUploadCards, getUploadQueueStatus } from './uploadQueuePolicy';

// Types
export type { BrowserTransfer, LocalTransfer, DriveTransfer, GalleryCard, AttemptCard, DraftCard, AttemptCardStatus } from './types';
export { getItemId, isVideoItem } from './types';
