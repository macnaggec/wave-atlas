import { memo } from 'react';
import { Badge, Button, Group, ActionIcon, Loader, rem, Skeleton, Stack, Text, Tooltip } from '@mantine/core';
import classes from './UploadCardRenderer.module.css';
import { IconRefresh, IconX } from '@tabler/icons-react';
import { MediaItem, MEDIA_STATUS } from 'entities/Media';
import { formatPrice } from 'shared/lib/currency';
import { GalleryCard, UploadStatus } from '../../model';
import DraftCard from '../cards/DraftCard';

interface UploadCardRendererProps {
  item: GalleryCard;
  /** Called when the user clicks the remove (X) button */
  onRemove?: (kind: GalleryCard['kind'], id: string) => void;
  /** Callback to retry failed upload */
  onRetry?: (id: string) => void;
  /** Whether the item has a date validation error (computed by parent) */
  hasDateError?: boolean;
  /** When true, suppresses the remove button (e.g. item is in committed 'saving' state) */
  hideRemove?: boolean;
}

/**
 * UploadCardRenderer - Memoized card renderer
 *
 * Dispatches rendering by card.kind:
 *   'draft'     — server-only MediaItem, always shows DraftCard overlays
 *   'uploading' — pipeline item, shows progress/error overlays until completed
 *
 * Handles both uploading and completed states.
 */
export const UploadCardRenderer = memo<UploadCardRendererProps>(({
  item,
  onRemove,
  onRetry,
  hasDateError,
  hideRemove,
}) => {
  if (item.kind === 'uploading' && item.pipelineItem.status === 'importing') {
    return <Skeleton radius="md" className={classes.importingCard} />;
  }

  const mediaItem = item.result;

  const isCompleted = item.kind === 'draft' || item.pipelineItem.status === 'completed';

  // Use thumbnailUrl (no watermark) for completed drafts — owner is viewing their own content.
  // lightboxUrl carries the watermark transform and is for public display only.
  const imageUrl = isCompleted && mediaItem
    ? mediaItem.thumbnailUrl
    : item.kind === 'uploading' ? item.pipelineItem.previewUrl : '';

  const resourceType = (isCompleted && mediaItem
    ? mediaItem.resource.resource_type
    : item.kind === 'uploading' && isVideoFile(item.pipelineItem.file) ? 'video' : 'image') as 'image' | 'video';

  const playbackUrl = isCompleted && mediaItem
    ? mediaItem.resource.playback_url
    : undefined;

  const alt = isCompleted && mediaItem
    ? `Media ${mediaItem.resource.asset_id}`
    : item.kind === 'uploading' ? (item.pipelineItem.file?.name || 'Upload preview') : 'Upload preview';

  const overlays = isCompleted
    ? (mediaItem ? renderDraftOverlay(mediaItem) : null)
    : item.kind === 'uploading'
      ? renderUploadOverlay(
          item.pipelineItem.status,
          item.pipelineItem.progress,
          item.pipelineItem.error,
          item.pipelineItem.id,
          item.pipelineItem.file ? onRetry : undefined,
        )
      : null;

  const actionButton = !hideRemove && onRemove ? (
    <ActionIcon
      variant="transparent"
      size="sm"
      radius="xl"
      aria-label="Remove"
      className={classes.actionBtn}
      onClick={(e) => {
        e.stopPropagation();
        onRemove(item.kind, item.id);
      }}
    >
      <IconX style={{ width: rem(12), height: rem(12) }} />
    </ActionIcon>
  ) : undefined;

  return (
    <DraftCard
      imageUrl={imageUrl}
      resourceType={resourceType}
      playbackUrl={playbackUrl}
      alt={alt}
      overlays={overlays}
      actions={actionButton}
      validation={hasDateError ? { hasError: true, message: 'Date required for publishing' } : undefined}
    />
  );
});

UploadCardRenderer.displayName = 'UploadCardRenderer';

const VIDEO_EXTENSIONS = /\.(mp4|mov|webm|avi|mkv)$/i;

function isVideoFile(file: File | null | undefined): boolean {
  if (!file) return false;
  if (file.type) return file.type.startsWith('video/');
  return VIDEO_EXTENSIONS.test(file.name);
}

function renderDraftOverlay(mediaItem: MediaItem) {
  const isDateFromExif = mediaItem.dateSource === 'exif';
  const formattedDate = mediaItem.capturedAt
    ? new Date(mediaItem.capturedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  const badges = [];

  if (mediaItem.status === MEDIA_STATUS.DRIVE_PENDING) {
    badges.push(<Badge key="drive" size="sm" color="blue" variant="light">Drive</Badge>);
  }

  if (mediaItem.price != null) {
    badges.push(
      <Badge key="price" size="sm" color="green" variant="filled">{formatPrice(mediaItem.price)}</Badge>
    );
  }

  if (formattedDate) {
    badges.push(<Badge key="date" size="sm" color="blue" variant="filled">{formattedDate}</Badge>);
  } else {
    badges.push(<Badge key="missing-date" size="sm" color="red" variant="filled">Missing Date</Badge>);
  }

  if (isDateFromExif) {
    badges.push(<Badge key="auto" size="xs" color="cyan" variant="light">Auto</Badge>);
  }

  return <Group gap="xs">{badges}</Group>;
}

function renderUploadOverlay(
  status: UploadStatus,
  progress: number,
  error: string | undefined,
  itemId: string,
  onRetry: ((id: string) => void) | undefined,
) {
  if (error) {
    return (
      <Stack gap={4} align="center">
        <Tooltip label={error} multiline maw={200}>
          <Text size="xs" c="red" lineClamp={1} ta="center">{error}</Text>
        </Tooltip>
        {onRetry && (
          <Button
            size="compact-xs"
            variant="light"
            color="blue"
            leftSection={<IconRefresh size={12} />}
            onClick={(e) => { e.stopPropagation(); onRetry(itemId); }}
          >
            Retry
          </Button>
        )}
      </Stack>
    );
  }

  let label: string | null = null;
  if (status === 'signing') label = 'Preparing…';
  else if (status === 'saving') label = 'Saving…';
  else if (status === 'uploading' && progress === 100) label = 'Processing…';
  else if (progress > 0) label = `${progress}%`;

  return (
    <Group gap="xs">
      <Loader size="xs" />
      {label && <Text size="xs" c="dimmed">{label}</Text>}
    </Group>
  );
}

