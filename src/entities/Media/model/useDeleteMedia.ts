import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTRPC } from 'shared/lib/trpc';

export function useDeleteMedia() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.media.delete.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: trpc.users.myUploads.queryKey() });
        void queryClient.invalidateQueries({ queryKey: trpc.users.myDraftCounts.queryKey() });
        void queryClient.invalidateQueries({ queryKey: trpc.media.myDrafts.queryKey() });
        // The mutation only knows the deleted media's id, not which session it belonged to —
        // invalidate broadly across all sessions rather than a specific one.
        void queryClient.invalidateQueries(trpc.sessions.mine.queryFilter());
        void queryClient.invalidateQueries(trpc.sessions.byId.queryFilter());
        void queryClient.invalidateQueries(trpc.sessions.list.pathFilter());
      },
    }),
  );
}
