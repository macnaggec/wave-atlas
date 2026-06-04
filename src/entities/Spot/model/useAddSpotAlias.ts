import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTRPC } from 'app/lib/trpc';

export function useAddSpotAlias() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.spots.addAlias.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: trpc.spots.list.queryKey() });
      },
    }),
  );
}
