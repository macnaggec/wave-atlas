'use client';

import React, { FC, memo } from 'react';
import { Group, Loader, Progress, Text } from '@mantine/core';
import { UploadStatus } from '../useUploadManager';

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
}) => {
  if (error) {
    return (
      <Text size="xs" c="red">
        Error
      </Text>
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
