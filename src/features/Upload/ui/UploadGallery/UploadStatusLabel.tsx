import { FC, memo, useMemo } from 'react';
import { Group, Loader, Text, ThemeIcon } from '@mantine/core';
import { IconCheck, IconPhoto, IconVideo } from '@tabler/icons-react';
import { GalleryCard, getUploadQueueStatus } from '../../model';

export interface UploadStatusLabelProps {
  items: GalleryCard[];
  hasActiveUploads: boolean;
  onOpen: () => void;
}

export const UploadStatusLabel: FC<UploadStatusLabelProps> = memo(({ items, hasActiveUploads, onOpen }) => {
  const { readyItems, uploadingCount } = useMemo(() => getUploadQueueStatus(items), [items]);

  const photoCount = readyItems.filter(c => c.kind === 'draft' && c.result.resource.resourceType !== 'video').length;
  const videoCount = readyItems.filter(c => c.kind === 'draft' && c.result.resource.resourceType === 'video').length;

  return (
    <Group px="md" py="sm" justify="space-between">
      {hasActiveUploads ? (
        <Group justify="space-between" style={{ flex: 1 }}>
          <Group gap={6} align="center">
            <Loader size={10} />
            <Text size="xs" c="dimmed">{uploadingCount} uploading</Text>
            {readyItems.length > 0 && (
              <Text size="xs" c="dimmed" style={{ opacity: 0.55 }}>· {readyItems.length} ready</Text>
            )}
          </Group>
          <Text size="xs" c="blue.4" fw={500} style={{ cursor: 'pointer' }} onClick={onOpen}>View</Text>
        </Group>
      ) : readyItems.length > 0 ? (
        <Group justify="space-between" style={{ flex: 1 }}>
          <Group gap={8} align="center">
            <ThemeIcon size={22} variant="transparent" style={{ color: 'var(--mantine-color-green-5)' }}>
              <IconCheck size={20} />
            </ThemeIcon>
            {photoCount > 0 && (
              <Group gap={3} align="center">
                <ThemeIcon size={22} variant="transparent" style={{ color: 'rgba(255,255,255,0.55)' }}>
                  <IconPhoto size={20} />
                </ThemeIcon>
                <Text size="xs" c="dimmed">{photoCount}</Text>
              </Group>
            )}
            {videoCount > 0 && (
              <Group gap={3} align="center">
                <ThemeIcon size={22} variant="transparent" style={{ color: 'rgba(255,255,255,0.55)' }}>
                  <IconVideo size={20} />
                </ThemeIcon>
                <Text size="xs" c="dimmed">{videoCount}</Text>
              </Group>
            )}
          </Group>
          <Text size="xs" c="blue.4" fw={500} style={{ cursor: 'pointer' }} onClick={onOpen}>View</Text>
        </Group>
      ) : items.length > 0 ? (
        <Text size="xs" c="red.4">Upload failed</Text>
      ) : null}
    </Group>
  );
});

UploadStatusLabel.displayName = 'UploadStatusLabel';
