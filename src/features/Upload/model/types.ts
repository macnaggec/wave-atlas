import type { MediaItem } from 'entities/Media';
import type { UploadAttemptStatus, UploadSource } from 'shared/types/upload';

// ── Browser-only transfer resources ────────────────────────────────────────
// The store owns these. They are lost on page reload.

export type LocalTransfer = {
  source: 'local';
  clientRequestId: string;
  attemptId?: string;         // undefined until beginLocal resolves
  file: File;
  previewUrl: string;
  progress: number;
  abort?: () => void;
};

export type DriveTransfer = {
  source: 'drive';
  clientRequestId: string;
  attemptId?: string;         // undefined until beginDrive resolves
  previewUrl: string;
};

export type BrowserTransfer = LocalTransfer | DriveTransfer;

// ── Gallery cards ────────────────────────────────────────────────────────────

/**
 * 'pending': beginLocal / beginDrive has not yet returned.
 * UploadAttemptStatus thereafter, from the Query projection.
 */
export type AttemptCardStatus = 'pending' | UploadAttemptStatus;

export type AttemptCard = {
  kind: 'attempt';
  /** clientRequestId before server responds; attemptId after. */
  id: string;
  source: UploadSource;
  status: AttemptCardStatus;
  previewUrl: string;
  progress?: number;       // local only
  errorCode?: string;      // set when status is FAILED
};

export type DraftCard = {
  kind: 'draft';
  id: string;
  result: MediaItem;
};

export type GalleryCard = AttemptCard | DraftCard;

export function getItemId(card: GalleryCard): string {
  return card.id;
}

export function isVideoItem(card: GalleryCard): boolean {
  if (card.kind === 'draft') return card.result.resource.resourceType === 'video';
  return false; // resource type known only after finalization
}

export function revokeBlobUrl(url?: string): void {
  if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
}
