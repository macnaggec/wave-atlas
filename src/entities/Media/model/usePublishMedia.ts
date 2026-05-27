import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTRPC } from 'app/lib/trpc';
import { notify } from 'shared/lib/notifications';
import { getErrorMessage } from 'shared/lib/getErrorMessage';

/**
 * Mutation hook for publishing individual media items (used outside session flow).
 * Invalidates spots.details on success.
 */
export function usePublishMedia() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.media.publish.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: trpc.spots.details.queryKey() });
      },
      onError: (err) => {
        notify.error(getErrorMessage(err), 'Publish Failed');
      },
    }),
  );
}
