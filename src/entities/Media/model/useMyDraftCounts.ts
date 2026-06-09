import { useQuery } from '@tanstack/react-query';
import { useTRPC } from 'app/lib/trpc';

export function useMyDraftCounts() {
  const trpc = useTRPC();
  return useQuery(trpc.users.myDraftCounts.queryOptions());
}
