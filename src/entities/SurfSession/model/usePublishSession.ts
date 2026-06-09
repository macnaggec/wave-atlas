import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTRPC } from 'app/lib/trpc';

export function usePublishSession() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.sessions.createAndPublish.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: trpc.users.myDraftCounts.queryKey() });
      },
    }),
  );
}
