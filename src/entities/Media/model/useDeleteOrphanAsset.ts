import { useMutation } from '@tanstack/react-query';
import { useTRPC } from 'app/lib/trpc';

export function useDeleteOrphanAsset() {
  const trpc = useTRPC();

  return useMutation(
    trpc.media.deleteOrphanAsset.mutationOptions(),
  );
}
