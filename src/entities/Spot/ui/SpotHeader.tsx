import { Group, Badge, Text, Title, Stack, Skeleton } from '@mantine/core';
import { IconMapPin } from '@tabler/icons-react';
import { SPOT_STATUS } from 'entities/Spot/constants';
import type { SpotHeaderData } from 'entities/Spot/types';

interface SpotHeaderProps {
  spot: SpotHeaderData | null;
}

export function HeaderSkeleton() {
  return (
    <Stack gap="xs">
      <Skeleton height={28} width="60%" />
      <Skeleton height={16} width="40%" />
    </Stack>
  );
}

/**
 * SpotHeader — renders spot name, location, and verification badge.
 * Owns its loading state: renders HeaderSkeleton when spot is null.
 */
export function SpotHeader({ spot }: SpotHeaderProps) {
  if (!spot) return <HeaderSkeleton />;

  const { name, location, status } = spot;
  const verified = status === SPOT_STATUS.VERIFIED;

  return (
    <>
      <Title order={2} mb="xs">{name}</Title>
      <Group gap="md">
        {location && (
          <Group gap={4}>
            <IconMapPin size={16} color="var(--mantine-color-dimmed)" />
            <Text size="sm" c="dimmed">{location}</Text>
          </Group>
        )}
        {verified && (
          <Badge color="green" variant="light">Verified</Badge>
        )}
      </Group>
    </>
  );
}
