'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTRPC } from 'app/lib/trpc';
import type { MediaItem } from 'entities/Media/types';

export { draftMediaKey } from './draftMediaKey';

/**
 * Client-side draft media hook, backed by TanStack Query via tRPC.
 */
export function useDraftMedia(spotId: string | null) {
  const trpc = useTRPC();
  const { data, isLoading, error } = useQuery({
    ...trpc.spots.drafts.queryOptions(spotId ?? ''),
    enabled: !!spotId,
  });
  return {
    draftMedia: data ?? [],
    isLoading,
    error,
  };
}

/**
 * Cache mutation helpers scoped to a spot's draft media query.
 *
 * - `refetch()` — invalidates TanStack Query cache (triggers re-fetch).
 * - `append(item)` — optimistically writes a new item, then revalidates.
 * - `remove(id)` — optimistically removes an item without revalidation.
 */
export function useDraftMediaMutate(spotId: string) {
  const queryClient = useQueryClient();
  const trpc = useTRPC();
  const queryOptions = trpc.spots.drafts.queryOptions(spotId);

  const refetch = () =>
    queryClient.invalidateQueries({ queryKey: queryOptions.queryKey });

  const append = (item: MediaItem) => {
    queryClient.setQueryData(
      queryOptions.queryKey,
      (current: MediaItem[] | undefined) => {
        if (!current) return [item];
        if (current.some((d) => d.id === item.id)) return current;
        return [...current, item];
      },
    );
    void queryClient.invalidateQueries({ queryKey: queryOptions.queryKey });
  };

  const remove = (id: string) => {
    queryClient.setQueryData(
      queryOptions.queryKey,
      (current: MediaItem[] | undefined) =>
        current ? current.filter((d) => d.id !== id) : [],
    );
  };

  const update = (ids: string[], updates: Partial<Pick<MediaItem, 'price' | 'capturedAt'>>) => {
    const idSet = new Set(ids);
    queryClient.setQueryData(
      queryOptions.queryKey,
      (current: MediaItem[] | undefined) =>
        current ? current.map((d) => (idSet.has(d.id) ? { ...d, ...updates } : d)) : [],
    );
  };

  return { refetch, append, remove, update };
}

