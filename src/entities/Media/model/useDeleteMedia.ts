import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTRPC } from 'app/lib/trpc';
import { notify } from 'shared/lib/notifications';
import { getErrorMessage } from 'shared/lib/getErrorMessage';

/**
 * Mutation hook for deleting a media item.
 *
 * Single source of truth for:
 * - tRPC delete call
 * - myUploads + myDraftCounts query invalidation
 * - error notification
 */
export function useDeleteMedia() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.media.delete.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: trpc.users.myUploads.queryKey() });
        void queryClient.invalidateQueries({ queryKey: trpc.users.myDraftCounts.queryKey() });
      },
      onError: (err) => {
        notify.error(getErrorMessage(err), 'Delete Failed');
      },
    }),
  );
}
