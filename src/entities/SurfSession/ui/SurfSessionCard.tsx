import { Badge, Group, Stack, Text } from '@mantine/core';
import { IconCalendar, IconMapPin, IconPhoto } from '@tabler/icons-react';
import { formatDateRange } from 'shared/lib/dateUtils';
import type { SurfSessionItem } from '../types';
import styles from './SurfSessionCard.module.css';

interface SurfSessionCardProps {
  session: SurfSessionItem;
}

export function SurfSessionCard({ session }: SurfSessionCardProps) {
  const isDraft = session.status === 'DRAFT';

  return (
    <Stack gap={0} className={styles.card}>
      <div className={styles.media}>
        {session.thumbnailUrl ? (
          <img
            src={session.thumbnailUrl}
            alt={session.spot.name}
            className={styles.image}
          />
        ) : (
          <div className={styles.placeholder}>
            <IconPhoto size={28} className={styles.placeholderIcon} />
          </div>
        )}
      </div>

      <Stack gap={4} p="xs">
        <Group gap={4} wrap="nowrap" justify="space-between">
          <Group gap={4} wrap="nowrap" className={styles.spotNameGroup}>
            <IconMapPin size={11} className={styles.metaIcon} />
            <Text size="xs" fw={600} truncate>{session.spot.name}</Text>
          </Group>
          {isDraft && (
            <Badge size="xs" color="yellow" variant="light">Draft</Badge>
          )}
        </Group>

        <Group gap={4} wrap="nowrap">
          <IconCalendar size={11} className={styles.metaIconDimmed} />
          <Text size="xs" c="dimmed" style={{ fontSize: 10 }}>
            {formatDateRange(session.startsAt, session.endsAt)}
          </Text>
        </Group>

        <Text size="xs" c="dimmed">
          {session.mediaCount} item{session.mediaCount !== 1 ? 's' : ''}
        </Text>
      </Stack>
    </Stack>
  );
}
