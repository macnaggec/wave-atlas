'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTRPC } from 'app/lib/trpc';
import type { MediaItem } from 'entities/Media/types';

export { draftMediaKey } from './draftMediaKey';

/**
 * Client-side draft media hook, backed by TanStack Query via tRPC.
 * Fetches draft media for a specific surf session.
 */
export function useDraftMedia(sessionId: string | null) {
  const trpc = useTRPC();
  const { data, isLoading, error } = useQuery({
    ...trpc.sessions.draftMedia.queryOptions(sessionId ?? ''),
    enabled: !!sessionId,
  });
  return {
    draftMedia: data ?? [],
    isLoading,
    error,
  };
}

/**
 * Cache mutation helpers scoped to a session's draft media query.
 */
export function useDraftMediaMutate(sessionId: string) {
  const queryClient = useQueryClient();
  const trpc = useTRPC();
  const queryOptions = trpc.sessions.draftMedia.queryOptions(sessionId);

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
