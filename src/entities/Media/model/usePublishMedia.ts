import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTRPC } from 'app/lib/trpc';
import { notify } from 'shared/lib/notifications';
import { getErrorMessage } from 'shared/lib/getErrorMessage';

/**
 * Mutation hook for publishing media items.
 *
 * Single source of truth for:
 * - tRPC publish call
 * - spots.details + spots.drafts query invalidation
 * - error notification
 */
export function usePublishMedia() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.media.publish.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: trpc.spots.details.queryKey() });
        void queryClient.invalidateQueries({ queryKey: trpc.spots.drafts.queryKey() });
      },
      onError: (err) => {
        notify.error(getErrorMessage(err), 'Publish Failed');
      },
    }),
  );
}
