import { useMutation } from '@tanstack/react-query';
import { useTRPC } from 'app/lib/trpc';

export function useRegisterDriveImport() {
  const trpc = useTRPC();
  return useMutation(trpc.media.registerDriveImport.mutationOptions());
}
