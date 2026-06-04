import { useQuery } from '@tanstack/react-query';
import { useTRPC } from 'app/lib/trpc';

export function useMySessions() {
  const trpc = useTRPC();
  return useQuery(trpc.sessions.mine.queryOptions());
}
