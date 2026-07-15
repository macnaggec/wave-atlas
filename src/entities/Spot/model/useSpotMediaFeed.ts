import { useMemo } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useTRPC } from 'shared/lib/trpc';
import { EMPTY_BROWSE_FILTERS, toBrowseDateRange, type BrowseFilters } from 'shared/model/browseFilters';

/** Published media, optionally scoped to a single spot; omit spotId to browse all spots. */
export function useSpotMediaFeed({
  spotId,
  filters = EMPTY_BROWSE_FILTERS,
  sortOrder = 'desc',
}: {
  spotId?: string;
  filters?: BrowseFilters;
  sortOrder?: 'asc' | 'desc';
} = {}) {
  const trpc = useTRPC();
  const dateRange = toBrowseDateRange(filters.date);

  const query = useInfiniteQuery(
    trpc.spots.mediaFeed.infiniteQueryOptions(
      { spotId, limit: 30, sortOrder, ...dateRange, favoriteSpotsOnly: filters.favoriteSpotsOnly },
      { getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined },
    ),
  );

  const flatItems = useMemo(
    () => query.data?.pages.flatMap((p) => p.items) ?? [],
    [query.data],
  );

  return { ...query, flatItems };
}
