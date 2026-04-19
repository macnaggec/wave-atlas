import { useMutation } from '@tanstack/react-query';
import { useTRPC } from 'app/lib/trpc';
import { notify } from 'shared/lib/notifications';
import { getErrorMessage } from 'shared/lib/getErrorMessage';

/**
 * Mutation hook for batch-updating media item metadata (price, capturedAt).
 *
 * Single source of truth for:
 * - tRPC updateBatch call
 * - error notification
 */
export function useUpdateBatchMedia() {
  const trpc = useTRPC();

  return useMutation(
    trpc.media.updateBatch.mutationOptions({
      onError: (err) => {
        notify.error(getErrorMessage(err), 'Update Failed');
      },
    }),
  );
}
