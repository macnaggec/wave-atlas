import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import {
  Center,
  Select,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
} from '@mantine/core';
import { IconMapPin } from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { useTRPC } from 'shared/lib/trpc';
import { SurfSessionCard } from 'entities/SurfSession';
import { PanelGalleryLayout } from 'shared/ui/PanelGalleryLayout';
import { BaseGallery } from 'shared/ui/BaseGallery';

export const Route = createFileRoute('/_panel/me/')({
  component: UploadsTab,
});

function UploadsTab() {
  const trpc = useTRPC();
  const { data: sessions = [], isLoading } = useQuery(trpc.sessions.mine.queryOptions());

  const [spotFilter, setSpotFilter] = useState<string | null>(null);

  const spotOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const s of sessions) {
      if (!seen.has(s.spot.id)) seen.set(s.spot.id, s.spot.name);
    }
    return Array.from(seen.entries()).map(([value, label]) => ({ value, label }));
  }, [sessions]);

  const visible = useMemo(
    () => (spotFilter ? sessions.filter((s) => s.spot.id === spotFilter) : sessions),
    [sessions, spotFilter],
  );

  if (isLoading) {
    return (
      <PanelGalleryLayout>
        <SimpleGrid cols={2} spacing="xs">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} height={160} radius="sm" />
          ))}
        </SimpleGrid>
      </PanelGalleryLayout>
    );
  }

  if (sessions.length === 0) {
    return (
      <PanelGalleryLayout>
        <Center mih={200}>
          <Text c="dimmed" size="sm">No sessions yet. Upload your first session!</Text>
        </Center>
      </PanelGalleryLayout>
    );
  }

  return (
    <PanelGalleryLayout>
      <Stack gap="sm">
        {spotOptions.length > 1 && (
          <Select
            placeholder="All spots"
            data={spotOptions}
            value={spotFilter}
            onChange={setSpotFilter}
            clearable
            size="xs"
            leftSection={<IconMapPin size={13} />}
          />
        )}

        <BaseGallery
          items={visible}
          aria-label="My uploads"
          renderCard={(session) => <SurfSessionCard session={session} />}
        />
      </Stack>
    </PanelGalleryLayout>
  );
}
