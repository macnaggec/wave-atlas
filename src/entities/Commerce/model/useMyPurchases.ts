import { useQuery } from '@tanstack/react-query';
import { useTRPC } from 'app/lib/trpc';

export function useMyPurchases() {
  const trpc = useTRPC();
  return useQuery(trpc.checkout.myPurchases.queryOptions());
}
