import { useLayoutEffect } from 'react';
import { motion } from 'framer-motion';
import { Center, Loader, Skeleton, Stack, Text } from '@mantine/core';
import { IconPhoto, IconMapPin } from '@tabler/icons-react';
import { useSessionFeed, type SessionFeedFilter, type SurfSessionItem } from 'entities/SurfSession';
import { formatDateRange } from 'shared/lib/dateUtils';
import { SIDE_PANEL_TRANSITION } from './panelMotion';
import styles from './SessionFeed.module.css';

const SESSION_CARD_TRACK = 'calc(25vw - 25px)';

// ─── Session card ──────────────────────────────────────────────────────────────

function SessionCard({ session, onClick }: { session: SurfSessionItem; onClick: () => void }) {
  return (
    <div className={styles.card} onClick={onClick}>
      <div className={styles.cardMedia}>
        {session.thumbnailUrl ? (
          <img
            src={session.thumbnailUrl}
            alt={session.spot.name}
            className={styles.thumbnail}
          />
        ) : (
          <Center className={styles.emptyMedia}>
            <IconPhoto size={24} color="rgba(255,255,255,0.25)" />
          </Center>
        )}
      </div>

      <Stack gap={2} className={styles.cardMeta}>
        <Text size="sm" fw={600} truncate>
          {session.spot.name}
        </Text>
        <Text size="xs" c="dimmed" truncate className={styles.locationText}>
          <IconMapPin size={10} className={styles.locationIcon} />
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
  activeFilter?: SessionFeedFilter;
  onSessionClick?: (session: SurfSessionItem) => void;
  /** Route-driven spot filter — takes precedence over mapStore.selection. */
  spotId?: string;
  /** Reports whether real cards are committed for a route-driven panel transition. */
  onLayoutReadyChange?: (ready: boolean) => void;
}

export function SessionFeed({
  expanded,
  activeFilter,
  onSessionClick,
  spotId: spotIdProp,
  onLayoutReadyChange,
}: SessionFeedProps) {
  const columns = expanded ? 3 : 1;

  const { data, isLoading, isFetchingNextPage, fetchNextPage, hasNextPage } =
    useSessionFeed({ spotId: spotIdProp, filter: activeFilter });

  const sessions = data?.pages.flatMap((p) => p.items) ?? [];

  useLayoutEffect(() => {
    if (isLoading) return;
    onLayoutReadyChange?.(true);
    return () => onLayoutReadyChange?.(false);
  }, [isLoading, onLayoutReadyChange]);

  return (
    <div className={styles.feed}>
      {isLoading ? (
        <div
          className={styles.grid}
          style={{ gridTemplateColumns: `repeat(${columns}, ${SESSION_CARD_TRACK})` }}
        >
          {Array.from({ length: columns * 3 }).map((_, i) => (
            <div key={i}>
              <Skeleton height={0} className={styles.skeletonMedia} />
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
            className={styles.grid}
            style={{ gridTemplateColumns: `repeat(${columns}, ${SESSION_CARD_TRACK})` }}
          >
            {sessions.map((s) => (
              <motion.div
                key={s.id}
                layout="position"
                layoutDependency={columns}
                transition={{ layout: SIDE_PANEL_TRANSITION }}
              >
                <SessionCard session={s} onClick={() => onSessionClick?.(s)} />
              </motion.div>
            ))}
          </div>

          {hasNextPage && !isFetchingNextPage && (
            <Center py="md">
              <Loader size="sm" onClick={() => fetchNextPage()} className={styles.loadMore} />
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
