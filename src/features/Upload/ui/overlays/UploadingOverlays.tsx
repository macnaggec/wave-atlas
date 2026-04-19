'use client';

import React, { FC, memo } from 'react';
import { Group, Loader, Text, Button, Stack, Tooltip } from '@mantine/core';
import { IconRefresh } from '@tabler/icons-react';
import { UploadStatus } from '../../model';

/**
 * Props for UploadingOverlays component
 */
export interface UploadingOverlaysProps {
  /** Current upload status */
  status: UploadStatus;

  /** Upload progress percentage (0-100) */
  progress: number;

  /** Optional error message */
  error?: string;

  /** Item ID for retry */
  itemId?: string;

  /** Callback to retry failed upload */
  onRetry?: (id: string) => void;
}

/**
 * UploadingOverlays - Display upload progress for in-flight uploads
 *
 * Shows spinner and progress bar during upload process.
 * Used as overlay slot content in DraftCard for uploading items.
 *
 * @example
 * ```tsx
 * <DraftCard
 *   mediaItem={placeholderMedia}
 *   overlays={
 *     <UploadingOverlays
 *       status={item.status}
 *       progress={item.progress}
 *       error={item.error}
 *     />
 *   }
 * />
 * ```
 */
const UploadingOverlays: FC<UploadingOverlaysProps> = memo(({
  status,
  progress,
  error,
  itemId,
  onRetry,
}) => {
  if (error) {
    const handleRetry = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (itemId && onRetry) {
        onRetry(itemId);
      }
    };

    return (
      <Stack gap={4} align="center">
        <Tooltip label={error} multiline maw={200}>
          <Text size="xs" c="red" lineClamp={1} ta="center">
            {error}
          </Text>
        </Tooltip>
        {itemId && onRetry && (
          <Button
            size="compact-xs"
            variant="light"
            color="blue"
            leftSection={<IconRefresh size={12} />}
            onClick={handleRetry}
          >
            Retry
          </Button>
        )}
      </Stack>
    );
  }

  return (
    <Group gap="xs">
      <Loader size="xs" />
      {progress > 0 && (
        <Text size="xs" c="dimmed">
          {progress}%
        </Text>
      )}
    </Group>
  );
});

UploadingOverlays.displayName = 'UploadingOverlays';

export default UploadingOverlays;
