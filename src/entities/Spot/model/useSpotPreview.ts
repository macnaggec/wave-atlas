import { useQuery } from '@tanstack/react-query';
import { useTRPC } from 'app/lib/trpc';

/** Minimal spot data for the drawer header — reads from the already-cached spots list, no extra request. */
export function useSpotPreview(spotId: string) {
  const trpc = useTRPC();
  return useQuery({
    ...trpc.spots.list.queryOptions(),
    select: (spots) => spots.find((s) => s.id === spotId) ?? null,
  });
}
