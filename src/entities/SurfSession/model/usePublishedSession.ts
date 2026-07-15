import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTRPC } from 'shared/lib/trpc';

export function useStartSessionEdit() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.uploads.startSessionEdit.mutationOptions({
      onSuccess: async (workspace, sessionId) => {
        await Promise.all([
          queryClient.invalidateQueries(trpc.uploads.getActiveWorkspace.queryFilter()),
          queryClient.invalidateQueries(trpc.uploads.getWorkspaceState.queryFilter({ workspaceId: workspace.id })),
          queryClient.invalidateQueries(trpc.sessions.mine.queryFilter()),
          queryClient.invalidateQueries(trpc.sessions.byId.queryFilter(sessionId)),
          queryClient.invalidateQueries(trpc.sessions.list.pathFilter()),
          queryClient.invalidateQueries(trpc.sessions.media.queryFilter(sessionId)),
        ]);
      },
    }),
  );
}

export function useRetireSurfSession() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.sessions.retire.mutationOptions({
      onSuccess: async (_result, sessionId) => {
        await Promise.all([
          queryClient.invalidateQueries(trpc.sessions.mine.queryFilter()),
          queryClient.invalidateQueries(trpc.sessions.byId.queryFilter(sessionId)),
          queryClient.invalidateQueries(trpc.sessions.list.pathFilter()),
          queryClient.invalidateQueries(trpc.sessions.media.queryFilter(sessionId)),
          queryClient.invalidateQueries(trpc.users.myUploads.queryFilter()),
        ]);
      },
    }),
  );
}
