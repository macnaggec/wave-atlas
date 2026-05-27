import { useInfiniteQuery } from '@tanstack/react-query';
import {
  Center,
  Group,
  Image,
  Loader,
  Skeleton,
  Stack,
  Text,
} from '@mantine/core';
import { IconCalendar, IconMapPin, IconPhoto } from '@tabler/icons-react';
import { useTRPC } from 'app/lib/trpc';
import type { SurfSessionItem } from 'entities/SurfSession/types';
import { formatDateRange } from 'shared/lib/dateUtils';

function SessionCard({ session }: { session: SurfSessionItem }) {
  return (
    <Stack
      gap={0}
      style={{
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        cursor: 'pointer',
      }}
      p="sm"
    >
      <Group gap="sm" wrap="nowrap">
        {session.thumbnailUrl ? (
          <Image
            src={session.thumbnailUrl}
            w={64}
            h={64}
            radius="sm"
            style={{ flexShrink: 0, objectFit: 'cover' }}
          />
        ) : (
          <Center
            w={64}
            h={64}
            style={{
              flexShrink: 0,
              borderRadius: 6,
              background: 'rgba(255,255,255,0.06)',
            }}
          >
            <IconPhoto size={20} color="rgba(255,255,255,0.3)" />
          </Center>
        )}

        <Stack gap={2} style={{ minWidth: 0 }}>
          <Group gap={4} wrap="nowrap">
            <IconMapPin size={12} style={{ color: 'rgba(255,255,255,0.5)', flexShrink: 0 }} />
            <Text size="sm" fw={600} truncate>
              {session.spot.name}
            </Text>
          </Group>
          <Text size="xs" c="dimmed" truncate>
            {session.spot.location}
          </Text>
          <Group gap={4} wrap="nowrap">
            <IconCalendar size={11} style={{ color: 'rgba(255,255,255,0.4)', flexShrink: 0 }} />
            <Text size="xs" c="dimmed">
              {formatDateRange(session.startsAt, session.endsAt)}
            </Text>
          </Group>
          <Text size="xs" c="dimmed">{session.mediaCount} photo{session.mediaCount !== 1 ? 's' : ''}</Text>
        </Stack>
      </Group>
    </Stack>
  );
}

// ─── Feed ─────────────────────────────────────────────────────────────────────

export function SessionFeed() {
  const trpc = useTRPC();

  const { data, isLoading, isFetchingNextPage, fetchNextPage, hasNextPage } =
    useInfiniteQuery({
      ...trpc.sessions.list.infiniteQueryOptions(
        { limit: 20 },
        { getNextPageParam: (last) => last.nextCursor ?? undefined },
      ),
    });

  const sessions = data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <Stack gap={0} h="100%">
      {/* Session list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {isLoading ? (
          <Stack gap="xs" p="sm">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} height={80} radius="sm" />
            ))}
          </Stack>
        ) : sessions.length === 0 ? (
          <Center h={200}>
            <Text size="sm" c="dimmed">No sessions yet</Text>
          </Center>
        ) : (
          <>
            {sessions.map((s) => (
              <SessionCard key={s.id} session={s} />
            ))}
            {hasNextPage && (
              <Center py="md">
                <Loader
                  size="sm"
                  onClick={() => fetchNextPage()}
                  style={{ cursor: 'pointer' }}
                />
              </Center>
            )}
            {isFetchingNextPage && (
              <Center py="md"><Loader size="sm" /></Center>
            )}
          </>
        )}
      </div>
    </Stack>
  );
}
