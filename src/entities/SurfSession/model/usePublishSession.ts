import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTRPC } from 'shared/lib/trpc';

export function usePublishSession() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.sessions.publish.mutationOptions({
      onSuccess: async (_published, draftId) => {
        queryClient.removeQueries(trpc.sessions.draft.queryFilter(draftId, { exact: true }));
        queryClient.removeQueries(trpc.sessions.draftMedia.queryFilter(draftId, { exact: true }));

        await Promise.all([
          queryClient.invalidateQueries(trpc.sessions.latestDraft.queryFilter()),
          queryClient.invalidateQueries(trpc.sessions.list.pathFilter()),
          queryClient.invalidateQueries(trpc.sessions.mine.queryFilter()),
          queryClient.invalidateQueries(trpc.sessions.byId.queryFilter(draftId)),
          queryClient.invalidateQueries(trpc.sessions.media.queryFilter(draftId)),
          queryClient.invalidateQueries(trpc.users.myDraftCounts.queryFilter()),
          queryClient.invalidateQueries(trpc.users.myUploads.queryFilter()),
          queryClient.invalidateQueries(trpc.media.myDrafts.queryFilter()),
        ]);
      },
    }),
  );
}
