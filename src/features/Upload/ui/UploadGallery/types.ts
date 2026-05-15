/**
 * Type definitions for UploadGallery components
 */

import { UseGallerySelectionReturn } from 'shared/hooks/gallery';
import { QueueItem } from '../../model';

/**
 * Available action types for upload items
 */
export type UploadItemAction = 'delete' | 'cancel' | 'retry' | 'edit';

/**
 * Props for UploadGallery component
 */
export interface UploadGalleryProps {
  /** Array of queue items (both uploading and completed) */
  items: QueueItem[];

  /** Whether there are active uploads in progress */
  hasActiveUploads: boolean;

  /** Whether this spot is blocked from uploading (another spot has active uploads) */
  isBlocked?: boolean;

  /** Callback to remove an item (async - deletes from DB for drafts) */
  onRemove: (id: string) => Promise<void>;

  /** Callback to cancel an upload (only aborts, doesn't delete from DB) */
  onCancelUpload: (id: string) => Promise<void>;

  /** Callback to add new files */
  onAddFiles?: (files: File[]) => void;

  /** Callback for bulk date editing */
  onBulkDateEdit?: (selectedIds: string[], date: Date) => void;

  /** Callback for bulk price editing */
  onBulkPriceEdit?: (selectedIds: string[], price: number) => void;

  /** Callback to retry failed upload */
  onRetry?: (id: string) => void;

  /** Callback to open Google Drive Picker */
  onDriveImport?: () => void;

  /** Set of mediaIds currently mid-publish (drives per-card publishing overlay) */
  publishingIds?: Set<string>;

  /** Actions to display on individual cards (parent controls based on selection mode) */
  actions?: UploadItemAction[];

  /** Callback when an individual card action is triggered */
  onAction?: (action: UploadItemAction, itemId: string) => void;

  /** Selection state owned by the parent — avoids duplicate source of truth */
  selection: UseGallerySelectionReturn<QueueItem>;
}
