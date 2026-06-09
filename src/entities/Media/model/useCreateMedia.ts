import { useMutation } from '@tanstack/react-query';
import { useTRPC } from 'app/lib/trpc';

export function useCreateMedia() {
  const trpc = useTRPC();
  return useMutation(trpc.media.create.mutationOptions());
}
