import { useQueryClient } from '@tanstack/react-query';
import { useTRPC } from 'app/lib/trpc';

export function useInvalidateSessionlessDrafts(spotId: string) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: trpc.media.sessionlessDrafts.queryKey({ spotId }) });
}
