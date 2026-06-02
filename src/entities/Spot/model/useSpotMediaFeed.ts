import { useMemo } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useTRPC } from 'app/lib/trpc';

export function useSpotMediaFeed(spotId: string, sortOrder: 'asc' | 'desc' = 'desc') {
  const trpc = useTRPC();

  const query = useInfiniteQuery(
    trpc.spots.mediaFeed.infiniteQueryOptions(
      { spotId, limit: 30, sortOrder },
      { getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined },
    ),
  );

  const flatItems = useMemo(
    () => query.data?.pages.flatMap((p) => p.items) ?? [],
    [query.data],
  );

  return { ...query, flatItems };
}
