import { useInfiniteQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Center, Loader, Skeleton, Stack, Text } from '@mantine/core';
import { IconPhoto, IconMapPin } from '@tabler/icons-react';
import { useTRPC } from 'app/lib/trpc';
import type { SurfSessionItem } from 'entities/SurfSession/types';
import { formatDateRange } from 'shared/lib/dateUtils';
import { useMapStore } from 'widgets/GlobeMap/model/mapStore';

// ─── Filter types & helpers (exported for AppShell) ───────────────────────────

export type ActiveFilter = 'today' | 'yesterday' | 'last7' | { date: Date } | null;

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
}

export function toDateRange(filter: ActiveFilter): { dateFrom?: Date; dateTo?: Date } {
  if (!filter) return {};
  const today = new Date();
  if (filter === 'today') return { dateFrom: startOfDay(today), dateTo: endOfDay(today) };
  if (filter === 'yesterday') {
    const y = new Date(today);
    y.setDate(y.getDate() - 1);
    return { dateFrom: startOfDay(y), dateTo: endOfDay(y) };
  }
  if (filter === 'last7') {
    const from = new Date(today);
    from.setDate(from.getDate() - 7);
    return { dateFrom: startOfDay(from), dateTo: endOfDay(today) };
  }
  return { dateFrom: startOfDay(filter.date), dateTo: endOfDay(filter.date) };
}

// ─── Session card ──────────────────────────────────────────────────────────────

function SessionCard({ session, onClick }: { session: SurfSessionItem; onClick: () => void }) {
  return (
    <div style={{ cursor: 'pointer' }} onClick={onClick}>
      <div
        style={{
          position: 'relative',
          aspectRatio: '16 / 10',
          borderRadius: 10,
          overflow: 'hidden',
          background: 'rgba(255,255,255,0.06)',
          marginBottom: 8,
        }}
      >
        {session.thumbnailUrl ? (
          <img
            src={session.thumbnailUrl}
            alt={session.spot.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <Center style={{ height: '100%' }}>
            <IconPhoto size={24} color="rgba(255,255,255,0.25)" />
          </Center>
        )}
      </div>

      <Stack gap={2} style={{ paddingBottom: 4 }}>
        <Text size="sm" fw={600} truncate>
          {session.spot.name}
        </Text>
        <Text size="xs" c="dimmed" truncate style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <IconMapPin size={10} style={{ flexShrink: 0 }} />
          {session.spot.location}
        </Text>
        <Text size="xs" c="dimmed">
          {formatDateRange(session.startsAt, session.endsAt)}
        </Text>
      </Stack>
    </div>
  );
}

// ─── Feed ─────────────────────────────────────────────────────────────────────

interface SessionFeedProps {
  expanded?: boolean;
  activeFilter?: ActiveFilter;
  onSessionClick?: (session: SurfSessionItem) => void;
  /** Route-driven spot filter — takes precedence over mapStore.selection. */
  spotId?: string;
}

export function SessionFeed({ expanded, activeFilter, onSessionClick, spotId: spotIdProp }: SessionFeedProps) {
  const trpc = useTRPC();
  const storeSpotId = useMapStore((s) => s.selection?.id ?? null);
  const selectedSpotId = spotIdProp ?? storeSpotId;

  const dateRange = toDateRange(activeFilter ?? null);
  const columns = expanded ? 3 : 1;

  const { data, isLoading, isFetchingNextPage, fetchNextPage, hasNextPage } =
    useInfiniteQuery({
      ...trpc.sessions.list.infiniteQueryOptions(
        { limit: 20, spotId: selectedSpotId ?? undefined, ...dateRange },
        { getNextPageParam: (last) => last.nextCursor ?? undefined },
      ),
    });

  const sessions = data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
      {isLoading ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${columns}, 1fr)`,
            gap: 12,
            padding: 12,
          }}
        >
          {Array.from({ length: columns * 3 }).map((_, i) => (
            <div key={i}>
              <Skeleton height={0} style={{ paddingBottom: '62.5%', borderRadius: 10, marginBottom: 8 }} />
              <Skeleton height={14} mb={4} radius="sm" />
              <Skeleton height={11} width="60%" radius="sm" />
            </div>
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <Center h={200}>
          <Text size="sm" c="dimmed">No sessions found</Text>
        </Center>
      ) : (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${columns}, 1fr)`,
              gap: 12,
              padding: 12,
            }}
          >
            {sessions.map((s) => (
              <motion.div key={s.id} layout>
                <SessionCard session={s} onClick={() => onSessionClick?.(s)} />
              </motion.div>
            ))}
          </div>

          {hasNextPage && !isFetchingNextPage && (
            <Center py="md">
              <Loader size="sm" onClick={() => fetchNextPage()} style={{ cursor: 'pointer' }} />
            </Center>
          )}
          {isFetchingNextPage && (
            <Center py="md"><Loader size="sm" /></Center>
          )}
        </>
      )}
    </div>
  );
}
