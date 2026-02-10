'use client';

import { useCallback, useMemo, useState } from 'react';
import { Box, Badge, Button, Group } from '@mantine/core';
import { IconUpload } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { publishMediaItems } from 'app/actions/media';
import { notify } from 'shared/lib/notifications';
import { UploadItem } from './useUploadManager';

export interface PublishButtonProps {
  /** Queue of upload items to check for publish readiness */
  queue: UploadItem[];
  /** Callback after successful publish to remove items from queue */
  onPublishSuccess?: (mediaIds: string[]) => void;
}

/**
 * PublishButton - Floating button to publish all ready draft uploads
 *
 * Shows progress badge and publish button when drafts exist.
 * Button appears only when ALL items meet requirements:
 * - capturedAt (date)
 * - price >= 0 (set, including free)
 * - cloudinaryResult (URL)
 * - spotId
 *
 * Features:
 * - Fixed bottom-center positioning
 * - Progress indicator (X/Y ready)
 * - Loading state during publish
 * - Success/error notifications
 *
 * @example
 * ```tsx
 * <PublishButton queue={queue} onPublishSuccess={removeByMediaIds} />
 * ```
 */
export function PublishButton({ queue, onPublishSuccess }: PublishButtonProps) {
  const router = useRouter();
  const [isPublishing, setIsPublishing] = useState(false);

  // Calculate publish readiness
  const publishStats = useMemo(() => {
    const completedItems = queue.filter(item => item.status === 'completed' && item.result);

    const readyItems = completedItems.filter(item =>
      item.result?.capturedAt &&
      item.result?.price !== undefined &&
      item.result?.price >= 0 &&
      item.result?.resource.url &&
      item.result?.spotId
    );

    return {
      total: completedItems.length,
      ready: readyItems.length,
      allReady: completedItems.length > 0 && readyItems.length === completedItems.length,
      mediaIds: readyItems.map(item => item.result!.id),
    };
  }, [queue]);

  // Publish handler
  const handlePublish = useCallback(async () => {
    if (publishStats.mediaIds.length === 0) return;

    setIsPublishing(true);
    const result = await publishMediaItems({ mediaIds: publishStats.mediaIds });
    setIsPublishing(false);

    if (result.success) {
      notify.success(`Successfully published ${result.data.length} item(s)`, 'Published');

      // Remove published items from upload queue
      onPublishSuccess?.(publishStats.mediaIds);

      // Force data refresh - router.refresh() is more reliable than hard reload
      router.refresh();
    } else {
      notify.error(result.error, 'Publish Failed');
    }
  }, [publishStats.mediaIds, onPublishSuccess, router]);

  // Don't render if no completed items
  if (publishStats.total === 0) return null;

  return (
    <Box
      style={{
        position: 'fixed',
        bottom: 'var(--mantine-spacing-xl)',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 100,
      }}
    >
      <Group gap="sm">
        {/* Progress Badge */}
        <Badge
          size="lg"
          variant={publishStats.allReady ? 'filled' : 'light'}
          color={publishStats.allReady ? 'green' : 'gray'}
        >
          {publishStats.ready}/{publishStats.total} ready
        </Badge>

        {/* Publish Button */}
        {publishStats.allReady && (
          <Button
            size="lg"
            leftSection={<IconUpload size={20} />}
            onClick={handlePublish}
            loading={isPublishing}
            color="green"
            style={{ boxShadow: 'var(--mantine-shadow-md)' }}
          >
            Publish All
          </Button>
        )}
      </Group>
    </Box>
  );
}
