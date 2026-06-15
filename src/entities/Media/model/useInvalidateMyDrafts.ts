import { useQueryClient } from '@tanstack/react-query';
import { useTRPC } from 'app/lib/trpc';

export function useInvalidateMyDrafts() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: trpc.media.myDrafts.queryKey() });
}
