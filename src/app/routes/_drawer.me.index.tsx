import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import {
  Badge,
  Center,
  Group,
  Image,
  Select,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
} from '@mantine/core';
import { IconCalendar, IconMapPin, IconPhoto } from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { useTRPC } from 'app/lib/trpc';
import type { SurfSessionItem } from 'entities/SurfSession/types';
import { formatDateRange } from 'shared/lib/dateUtils';

export const Route = createFileRoute('/_drawer/me/')({
  component: UploadsTab,
});

function SessionCard({ session }: { session: SurfSessionItem }) {
  const isDraft = session.status === 'DRAFT';

  return (
    <Stack
      gap={0}
      style={{
        borderRadius: 8,
        border: '1px solid rgba(255,255,255,0.1)',
        overflow: 'hidden',
        cursor: 'pointer',
      }}
    >
      {session.thumbnailUrl ? (
        <Image
          src={session.thumbnailUrl}
          h={120}
          style={{ objectFit: 'cover', width: '100%' }}
        />
      ) : (
        <Center h={120} style={{ background: 'rgba(255,255,255,0.04)' }}>
          <IconPhoto size={28} color="rgba(255,255,255,0.2)" />
        </Center>
      )}

      <Stack gap={4} p="xs">
        <Group gap={4} wrap="nowrap" justify="space-between">
          <Group gap={4} wrap="nowrap" style={{ minWidth: 0 }}>
            <IconMapPin size={11} style={{ color: 'rgba(255,255,255,0.45)', flexShrink: 0 }} />
            <Text size="xs" fw={600} truncate>{session.spot.name}</Text>
          </Group>
          {isDraft && (
            <Badge size="xs" color="yellow" variant="light">Draft</Badge>
          )}
        </Group>

        <Group gap={4} wrap="nowrap">
          <IconCalendar size={11} style={{ color: 'rgba(255,255,255,0.35)', flexShrink: 0 }} />
          <Text size="xs" c="dimmed" style={{ fontSize: 10 }}>
            {formatDateRange(session.startsAt, session.endsAt)}
          </Text>
        </Group>

        <Text size="xs" c="dimmed">{session.mediaCount} item{session.mediaCount !== 1 ? 's' : ''}</Text>
      </Stack>
    </Stack>
  );
}

// ─── Tab ─────────────────────────────────────────────────────────────────────

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
      <SimpleGrid cols={2} spacing="xs" mt="sm">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} height={160} radius="sm" />
        ))}
      </SimpleGrid>
    );
  }

  if (sessions.length === 0) {
    return (
      <Center mih={200}>
        <Text c="dimmed" size="sm">No sessions yet. Upload your first session!</Text>
      </Center>
    );
  }

  return (
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

      <SimpleGrid cols={2} spacing="xs">
        {visible.map((s) => (
          <SessionCard key={s.id} session={s} />
        ))}
      </SimpleGrid>
    </Stack>
  );
}
