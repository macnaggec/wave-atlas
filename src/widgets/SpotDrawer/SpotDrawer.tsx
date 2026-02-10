'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Drawer, Text, Group, Badge, Box, Title, ActionIcon, Tabs, useMatches } from '@mantine/core';
import { IconX, IconMapPin, IconUser } from '@tabler/icons-react';
import { useSpotDrawerContext } from './SpotDrawerContext';
import { GalleryTab } from './GalleryTab';
import { UploadTab } from './UploadTab';
import { memo, useCallback, useState } from 'react';
import classes from './SpotDrawer.module.css';

interface SpotDrawerProps {
  onClose?: () => void;
  opened?: boolean; // Control opened state externally for transitions
}


export const SpotDrawer = memo(({ onClose, opened }: SpotDrawerProps) => {
  const { spotData } = useSpotDrawerContext();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const rawTab = searchParams.get('tab');
  const activeTab = rawTab === 'upload' ? 'upload' : 'gallery';

  const drawerSize = useMatches({ base: '100%', sm: 'xl' });

  // Track active uploads state from upload panel
  const [hasActiveUploads, setHasActiveUploads] = useState(false);

  const handleClose = useCallback(() => {
    if (hasActiveUploads) {
      const confirmed = window.confirm(
        'You have uploads in progress. Closing this drawer will cancel them. Are you sure?'
      );
      if (!confirmed) return;
    }

    if (onClose) {
      onClose();
    } else {
      router.back();
    }
  }, [hasActiveUploads, onClose, router]);

  const handleTabChange = useCallback((value: string | null) => {
    if (!spotData || !value) return;

    router.replace(`${pathname}?tab=${value}`);
  }, [spotData, router, pathname]);

  return (
    <Drawer
      opened={opened ?? !!spotData}
      onClose={handleClose}
      position="right"
      size={drawerSize}
      padding="md"
      title={null} // Custom header
      withCloseButton={false}
      styles={{
        content: { display: 'flex', flexDirection: 'column' },
        body: { flex: 1, display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' },
      }}
    >
      <Tabs value={activeTab} onChange={handleTabChange} keepMounted style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        <Box p="md" bg="white" style={{ flexShrink: 0 }}>
          <Group justify="space-between" align="start" mb="xs">
            <Title order={2}>{spotData?.name || 'Loading...'}</Title>
            <ActionIcon variant="transparent" color="gray" onClick={handleClose}>
              <IconX size={24} />
            </ActionIcon>
          </Group>

          <Group gap="md">
            {spotData?.location && (
              <Group gap={4}>
                <IconMapPin size={16} color="var(--mantine-color-dimmed)" />
                <Text size="sm" c="dimmed">{spotData.location}</Text>
              </Group>
            )}

            {spotData?.creatorName && (
              <Group gap={4}>
                <IconUser size={16} color="var(--mantine-color-dimmed)" />
                <Text size="sm" c="dimmed">Added by {spotData.creatorName}</Text>
              </Group>
            )}

            {spotData?.status === 'verified' && <Badge color="green" variant="light">Verified</Badge>}
          </Group>

          <Tabs.List mt="md">
            <Tabs.Tab value="gallery">Gallery ({spotData?.media.length ?? 0})</Tabs.Tab>
            <Tabs.Tab value="upload">Upload</Tabs.Tab>
          </Tabs.List>
        </Box>

        <Tabs.Panel value="gallery" className={classes.tabContent} p="md">
          {spotData && <GalleryTab />}
        </Tabs.Panel>

        <Tabs.Panel value="upload" className={classes.tabContent} p="md">
          {spotData && <UploadTab onActiveUploadsChange={setHasActiveUploads} />}
        </Tabs.Panel>
      </Tabs>
    </Drawer>
  );
});

SpotDrawer.displayName = 'SpotDrawer';
