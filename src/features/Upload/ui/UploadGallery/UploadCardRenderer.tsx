import { memo } from 'react';
import { Group, ActionIcon, rem, Badge, Loader, Text, Button, Stack, Tooltip } from '@mantine/core';
import { IconTrash, IconRefresh, IconPencil, IconX } from '@tabler/icons-react';
import { QueueItem, UploadStatus } from '../../model';
import { UploadItemAction } from './types';
import DraftCard from '../cards/DraftCard';
import { MediaItem } from 'entities/Media/types';
import { formatPrice } from 'shared/lib/currency';

const ACTION_ICONS: Record<
  UploadItemAction,
  { icon: typeof IconTrash; label: string; color: string }
> = {
  delete: { icon: IconTrash, label: 'Delete', color: 'red' },
  cancel: { icon: IconX, label: 'Cancel', color: 'gray' },
  retry: { icon: IconRefresh, label: 'Retry', color: 'blue' },
  edit: { icon: IconPencil, label: 'Edit', color: 'gray' },
};

interface UploadCardRendererProps {
  item: QueueItem;
  /** Actions to show on the card — omit or pass [] to hide all */
  actions?: UploadItemAction[];
  /** Callback when a card action is triggered */
  onAction?: (action: UploadItemAction, itemId: string) => void;
  /** Callback to retry failed upload */
  onRetry?: (id: string) => void;
  /** Whether the item has a date validation error (computed by parent) */
  hasDateError?: boolean;
}

export const UploadCardRenderer = memo<UploadCardRendererProps>(({
  item,
  actions,
  onAction,
  onRetry,
  hasDateError,
}) => {
  const isCompleted = item.status === 'completed';

  // Use thumbnailUrl (no watermark) for completed drafts — owner is viewing their own content.
  // lightboxUrl carries the watermark transform and is for public display only.
  const imageUrl = isCompleted && item.result
    ? item.result.thumbnailUrl
    : item.previewUrl;

  const resourceType = (isCompleted && item.result
    ? item.result.resource.resource_type
    : isVideoFile(item.file) ? 'video' : 'image') as 'image' | 'video';

  const playbackUrl = isCompleted && item.result
    ? item.result.resource.playback_url
    : undefined;

  const alt = isCompleted && item.result
    ? `Media ${item.result.resource.asset_id}`
    : item.file?.name || 'Upload preview';

  const overlays = isCompleted && item.result
    ? renderDraftOverlay(item.result)
    : renderUploadOverlay(item.status, item.progress, item.error, item.id, onRetry);

  const actionButtons = actions && actions.length > 0 ? (
    <Group gap="xs">
      {actions.map((actionType) => {
        const config = ACTION_ICONS[actionType];
        const Icon = config.icon;
        return (
          <ActionIcon
            key={actionType}
            variant="filled"
            color={config.color}
            size="sm"
            radius="xl"
            aria-label={config.label}
            onClick={(e) => {
              e.stopPropagation();
              onAction?.(actionType, item.id);
            }}
          >
            <Icon style={{ width: rem(14), height: rem(14) }} />
          </ActionIcon>
        );
      })}
    </Group>
  ) : undefined;

  return (
    <DraftCard
      imageUrl={imageUrl}
      resourceType={resourceType}
      playbackUrl={playbackUrl}
      alt={alt}
      overlays={overlays}
      actions={actionButtons}
      validation={
        hasDateError
          ? { hasError: true, message: 'Date required for publishing' }
          : undefined
      }
    />
  );
},
  (prev, next) =>
    prev.item.id === next.item.id &&
    prev.item.status === next.item.status &&
    prev.item.progress === next.item.progress &&
    prev.item.error === next.item.error &&
    prev.item.result?.capturedAt === next.item.result?.capturedAt &&
    prev.item.result?.price === next.item.result?.price &&
    prev.hasDateError === next.hasDateError &&
    prev.actions?.join() === next.actions?.join()
);

UploadCardRenderer.displayName = 'UploadCardRenderer';

function renderDraftOverlay(mediaItem: MediaItem) {
  const isDateFromExif = mediaItem.dateSource === 'exif';
  const formattedDate = mediaItem.capturedAt
    ? new Date(mediaItem.capturedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <Group gap="xs">
      <Badge size="sm" color="green" variant="filled">
        {formatPrice(mediaItem.price)}
      </Badge>
      {formattedDate
        ? <Badge size="sm" color="blue" variant="filled">{formattedDate}</Badge>
        : <Badge size="sm" color="red" variant="filled">Missing Date</Badge>
      }
      {isDateFromExif && <Badge size="xs" color="cyan" variant="light">Auto</Badge>}
    </Group>
  );
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

function isVideoFile(file: File | null | undefined): boolean {
  if (!file) return false;
  if (file.type) return file.type.startsWith('video/');
  return /\.(mp4|mov|webm|avi|mkv)$/i.test(file.name);
}
