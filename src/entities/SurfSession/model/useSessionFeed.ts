import { useInfiniteQuery } from '@tanstack/react-query';
import { useTRPC } from 'shared/lib/trpc';

export type SessionFeedFilter = 'today' | 'yesterday' | 'last7' | { date: Date } | null;

interface SessionFeedParams {
  spotId?: string | null;
  filter?: SessionFeedFilter;
  limit?: number;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
}

export function toSessionFeedDateRange(
  filter: SessionFeedFilter,
): { dateFrom?: Date; dateTo?: Date } {
  if (!filter) return {};

  const today = new Date();
  if (filter === 'today') {
    return { dateFrom: startOfDay(today), dateTo: endOfDay(today) };
  }
  if (filter === 'yesterday') {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    return { dateFrom: startOfDay(yesterday), dateTo: endOfDay(yesterday) };
  }
  if (filter === 'last7') {
    const from = new Date(today);
    from.setDate(from.getDate() - 6);
    return { dateFrom: startOfDay(from), dateTo: endOfDay(today) };
  }

  return { dateFrom: startOfDay(filter.date), dateTo: endOfDay(filter.date) };
}

export function useSessionFeed({
  spotId,
  filter = null,
  limit = 20,
}: SessionFeedParams = {}) {
  const trpc = useTRPC();
  const dateRange = toSessionFeedDateRange(filter);

  return useInfiniteQuery({
    ...trpc.sessions.list.infiniteQueryOptions(
      { limit, spotId: spotId ?? undefined, ...dateRange },
      { getNextPageParam: (last) => last.nextCursor ?? undefined },
    ),
  });
}
