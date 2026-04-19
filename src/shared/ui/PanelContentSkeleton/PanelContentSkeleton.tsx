'use client';

import { SimpleGrid, Skeleton, Stack } from '@mantine/core';

const CARD_COUNT = 6;

/**
 * PanelContentSkeleton — loading placeholder for the spot panel tab body.
 *
 * Mirrors BaseGallery's 3-column grid so the transition from skeleton to
 * content is visually stable. Used as the Suspense fallback in SpotLayout
 * while the RSC page (gallery or upload) is in-flight.
 */
export function PanelContentSkeleton() {
  return (
    <Stack gap="md">
      <SimpleGrid cols={3} spacing={10}>
        {Array.from({ length: CARD_COUNT }, (_, i) => (
          <Skeleton key={i} height={110} radius="sm" />
        ))}
      </SimpleGrid>
    </Stack>
  );
}
