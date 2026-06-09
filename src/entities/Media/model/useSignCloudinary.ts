import { useMutation } from '@tanstack/react-query';
import { useTRPC } from 'app/lib/trpc';

export function useSignCloudinary() {
  const trpc = useTRPC();
  return useMutation(trpc.media.signCloudinary.mutationOptions());
}
