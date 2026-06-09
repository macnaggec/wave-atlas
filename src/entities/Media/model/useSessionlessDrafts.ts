import { useQuery } from '@tanstack/react-query';
import { useTRPC } from 'app/lib/trpc';

export function useSessionlessDrafts(spotId: string, options?: { enabled?: boolean }) {
  const trpc = useTRPC();
  return useQuery({ ...trpc.media.sessionlessDrafts.queryOptions({ spotId }), ...options });
}
