'use client';

import { useCallback, useMemo, useEffect } from 'react';
import { Button, Center, Stack, Text, Title } from '@mantine/core';
import { IconLogin2 } from '@tabler/icons-react';
import { signIn } from 'next-auth/react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useSpotDrawerContext } from './SpotDrawerContext';
import { useUploadManager } from 'features/Upload/useUploadManager';
import UploadGallery from 'features/Upload/UploadGallery';
import { PublishButton } from 'features/Upload/PublishButton';
import { updateDraftMetadata } from 'app/actions/media';
import { notify } from 'shared/lib/notifications';

interface UploadTabProps {
  onActiveUploadsChange: (hasActive: boolean) => void;
}

export function UploadTab({ onActiveUploadsChange }: UploadTabProps) {
  const { spotData, draftMedia } = useSpotDrawerContext();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentUrl = useMemo(() => {
    const query = searchParams.toString();
    return `${pathname}${query ? `?${query}` : ''}`;
  }, [pathname, searchParams]);

  const handleSignIn = useCallback(() => {
    // URL-encode the redirect URL to preserve query parameters
    // This ensures /spot?tab=upload is properly encoded as callbackUrl
    void signIn(undefined, { callbackUrl: currentUrl });
  }, [currentUrl]);

  const {
    queue,
    addFiles,
    remove,
    removeByMediaIds,
    retry,
    updateMetadata,
    hasActiveUploads
  } = useUploadManager(
    spotData?.id || '',
    draftMedia
  );

  // Notify parent when active upload state changes
  useEffect(() => {
    onActiveUploadsChange?.(hasActiveUploads);
  }, [hasActiveUploads, onActiveUploadsChange]);

  // Map selected UploadItem IDs to MediaItem IDs
  const getMediaIds = useCallback((selectedIds: string[]): string[] => {
    const targetIds = selectedIds.length > 0
      ? selectedIds
      : queue.filter(item => item.status === 'completed' && item.result).map(item => item.id);

    if (targetIds.length === 0) return [];

    const selectedSet = new Set(targetIds);
    return queue
      .filter(item => selectedSet.has(item.id) && item.result)
      .map(item => item.result!.id);
  }, [queue]);

  const handleBulkPriceEdit = useCallback(async (
    selectedIds: string[],
    price: number
  ) => {
    const mediaIds = getMediaIds(selectedIds);
    if (mediaIds.length === 0) return;

    const result = await updateDraftMetadata({ mediaIds, price });

    if (result.success) {
      updateMetadata(mediaIds, { price });
      notify.success(`Updated price for ${mediaIds.length} item(s)`, 'Price Updated');
    } else {
      notify.error(result.error, 'Update Failed');
    }
  }, [getMediaIds, updateMetadata]);

  const handleBulkDateEdit = useCallback(async (selectedIds: string[], date: Date) => {
    const mediaIds = getMediaIds(selectedIds);
    if (mediaIds.length === 0) return;

    const result = await updateDraftMetadata({ mediaIds, capturedAt: date });

    if (result.success) {
      updateMetadata(mediaIds, { capturedAt: date });
      notify.success(`Updated date for ${mediaIds.length} item(s)`, 'Date Updated');
    } else {
      notify.error(result.error, 'Update Failed');
    }
  }, [getMediaIds, updateMetadata]);

  return (
    <>
      {!spotData?.id ? (
        <Text c="dimmed">Select a spot to upload.</Text>
      ) : draftMedia === null ? (
        <Center mih={260}>
          <Stack gap="xs" align="center" ta="center">
            <Title order={4}>Sign in to upload</Title>
            <Text c="dimmed" maw={360}>
              Uploads are tied to your account so you can manage them later.
            </Text>
            <Button leftSection={<IconLogin2 size={16} />} onClick={handleSignIn}>
              Sign in
            </Button>
          </Stack>
        </Center>
      ) : (
        <>
          <UploadGallery
            items={queue}
            onRemove={remove}
            onAddFiles={addFiles}
            onRetry={retry}
            onBulkDateEdit={handleBulkDateEdit}
            onBulkPriceEdit={handleBulkPriceEdit}
          />
          <PublishButton queue={queue} onPublishSuccess={removeByMediaIds} />
        </>
      )}
    </>
  );
}
