import { useQuery } from '@tanstack/react-query';
import { useTRPC } from 'app/lib/trpc';

/** Fetches all spots for the globe map. Optionally filtered by search string. */
export function useSpots(search?: string) {
  const trpc = useTRPC();
  return useQuery(trpc.spots.list.queryOptions(search));
}
