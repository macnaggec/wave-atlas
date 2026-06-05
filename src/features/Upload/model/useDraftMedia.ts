

import { useQuery, useQueryClient } from '@tanstack/react-query';
// eslint-disable-next-line boundaries/dependencies -- CE1: Upload rework will move tRPC calls to entity hooks
import { useTRPC } from 'app/lib/trpc';
import type { MediaItem } from 'entities/Media/types';

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
 * When sessionId is null (deferred session flow), all operations are no-ops —
 * the Zustand upload queue is the sole source of truth until publish time.
 */
export function useDraftMediaMutate(sessionId: string | null) {
  const queryClient = useQueryClient();
  const trpc = useTRPC();
  const queryOptions = sessionId
    ? trpc.sessions.draftMedia.queryOptions(sessionId)
    : null;

  const refetch = (): Promise<unknown> => {
    if (queryOptions) return queryClient.invalidateQueries({ queryKey: queryOptions.queryKey });
    return Promise.resolve();
  };

  const append = (item: MediaItem) => {
    if (!queryOptions) return;
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
    if (!queryOptions) return;
    queryClient.setQueryData(
      queryOptions.queryKey,
      (current: MediaItem[] | undefined) =>
        current ? current.filter((d) => d.id !== id) : [],
    );
  };

  const update = (ids: string[], updates: Partial<Pick<MediaItem, 'price' | 'capturedAt'>>) => {
    if (!queryOptions) return;
    const idSet = new Set(ids);
    queryClient.setQueryData(
      queryOptions.queryKey,
      (current: MediaItem[] | undefined) =>
        current ? current.map((d) => (idSet.has(d.id) ? { ...d, ...updates } : d)) : [],
    );
  };

  return { refetch, append, remove, update };
}
