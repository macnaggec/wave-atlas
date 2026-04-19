import { useQuery } from '@tanstack/react-query';
import { useTRPC } from 'app/lib/trpc';

/** Full spot details including published media items. */
export function useSpotDetails(spotId: string) {
  const trpc = useTRPC();
  return useQuery(trpc.spots.details.queryOptions(spotId));
}
