import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTRPC } from 'app/lib/trpc';
import type { Spot } from '../types';

export function useCreateSpot() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.spots.create.mutationOptions({
      onSuccess: (spot) => {
        queryClient.setQueryData(
          trpc.spots.list.queryKey(),
          (prev: Spot[] = []) => [...prev, spot],
        );
        void queryClient.invalidateQueries({ queryKey: trpc.spots.withinBounds.queryKey() });
      },
    }),
  );
}
