/**
 * UPLOAD FEATURE - Public API
 *
 * Organized by FSD layers:
 * - model/  : Business logic (hooks, state)
 * - ui/     : Presentational components
 * - lib/    : Utilities and helpers
 */

// ============================================================================
// MODEL - Business Logic & State
// ============================================================================
export { useUploadManager } from './model';
export { useDraftMedia, useDraftMediaMutate, draftMediaKey } from './model';
export type { UploadItem, QueueItem, UploadStatus } from './model';

// ============================================================================
// UI - Main Components
// ============================================================================
export { UploadManager } from './ui/UploadManager';
export type { UploadManagerProps } from './ui/UploadManager';

export { UploadIndicatorAffix, UploadIndicatorCompact } from './ui/UploadIndicator';

export { UploadGallery } from './ui/UploadGallery';
export type { UploadGalleryProps, UploadItemAction } from './ui/UploadGallery/types';

export { PublishButton } from './ui/UploadGallery/PublishButton';
export type { PublishButtonProps } from './ui/UploadGallery/PublishButton';

// ============================================================================
// UI - Subcomponents (Cards, Overlays, Popovers)
// ============================================================================
export { default as DraftCard } from './ui/cards/DraftCard';
export type { DraftCardProps, ValidationState } from './ui/cards/DraftCard';

export { default as DraftOverlays } from './ui/overlays/DraftOverlays';
export type { DraftOverlaysProps } from './ui/overlays/DraftOverlays';

export { default as UploadingOverlays } from './ui/overlays/UploadingOverlays';
export type { UploadingOverlaysProps } from './ui/overlays/UploadingOverlays';

export { DateEditPopover, PriceEditPopover } from './ui/popovers';

