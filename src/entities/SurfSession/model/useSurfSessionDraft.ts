import { useMutation, useQuery } from '@tanstack/react-query';
import { useTRPC } from 'shared/lib/trpc';

export function useSurfSessionDraft(draftId: string) {
  const trpc = useTRPC();
  return useQuery(trpc.sessions.draft.queryOptions(draftId));
}

export function useLatestSurfSessionDraft(options?: { enabled?: boolean }) {
  const trpc = useTRPC();
  return useQuery({ ...trpc.sessions.latestDraft.queryOptions(), ...options });
}

export function useCreateSurfSessionDraft() {
  const trpc = useTRPC();
  return useMutation(trpc.sessions.create.mutationOptions());
}

export function useUpdateSurfSessionDraft() {
  const trpc = useTRPC();
  return useMutation(trpc.sessions.updateDraft.mutationOptions());
}
