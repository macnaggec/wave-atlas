import { useInfiniteQuery } from '@tanstack/react-query';
import { useTRPC } from 'app/lib/trpc';

interface SessionFeedParams {
  spotId?: string | null;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
}

export function useSessionFeed({ spotId, dateFrom, dateTo, limit = 20 }: SessionFeedParams) {
  const trpc = useTRPC();
  return useInfiniteQuery({
    ...trpc.sessions.list.infiniteQueryOptions(
      { limit, spotId: spotId ?? undefined, dateFrom, dateTo },
      { getNextPageParam: (last) => last.nextCursor ?? undefined },
    ),
  });
}
