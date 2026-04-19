'use client';

import { memo, ReactNode } from 'react';
import { QueueItem } from '../../model';
import DraftCard from '../cards/DraftCard';
import DraftOverlays from '../overlays/DraftOverlays';
import UploadingOverlays from '../overlays/UploadingOverlays';

interface UploadCardRendererProps {
  item: QueueItem;
  /** Optional action buttons (parent controls based on selection mode) */
  actions?: ReactNode;
  /** Callback to retry failed upload */
  onRetry?: (id: string) => void;
}

/**
 * UploadCardRenderer - Memoized card renderer
 *
 * Prevents unnecessary DOM re-mounts by comparing only essential props.
 * Handles both uploading and completed states.
 * Parent controls which actions to show (none during selection mode).
 */
export const UploadCardRenderer = memo<UploadCardRendererProps>(({
  item, actions, onRetry
}) => {
  const isCompleted = item.status === 'completed';

  // Extract display props inline to avoid object spreading
  const imageUrl = isCompleted && item.result
    ? item.result.resource.url
    : item.previewUrl;

  const resourceType = (isCompleted && item.result
    ? item.result.resource.resource_type
    : item.file?.type.startsWith('video/') ? 'video' : 'image') as 'image' | 'video';

  const playbackUrl = isCompleted && item.result
    ? item.result.resource.playback_url
    : undefined;

  const alt = isCompleted && item.result
    ? `Media ${item.result.resource.asset_id}`
    : item.file?.name || 'Upload preview';

  // Choose overlays based on status
  const overlays = isCompleted && item.result
    ? <DraftOverlays mediaItem={item.result} />
    : (
      <UploadingOverlays
        status={item.status}
        progress={item.progress}
        error={item.error}
        itemId={item.id}
        onRetry={onRetry}
      />
    );

  return (
    <DraftCard
      imageUrl={imageUrl}
      resourceType={resourceType}
      playbackUrl={playbackUrl}
      alt={alt}
      overlays={overlays}
      actions={actions}
      validation={
        isCompleted && item.result && !item.result.capturedAt
          ? { hasError: true, message: 'Date required for publishing' }
          : undefined
      }
    />
  );
},
  // Only re-render if item status/progress/metadata/error OR actions visibility changes
  (prev, next) =>
    prev.item.id === next.item.id &&
    prev.item.status === next.item.status &&
    prev.item.progress === next.item.progress &&
    prev.item.error === next.item.error &&
    prev.item.result?.capturedAt === next.item.result?.capturedAt &&
    prev.item.result?.price === next.item.result?.price &&
    Boolean(prev.actions) === Boolean(next.actions)  // Re-render when actions visibility changes
);

UploadCardRenderer.displayName = 'UploadCardRenderer';
