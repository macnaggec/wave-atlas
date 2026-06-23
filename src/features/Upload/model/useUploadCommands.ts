import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTRPC } from 'shared/lib/trpc';

/**
 * All tRPC mutations and Query wiring for the upload lifecycle.
 * The coordinator receives these as plain async functions — no tRPC imports needed there.
 */
export function useUploadCommands(draftId: string) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const invalidateDraftMedia = () =>
    queryClient.invalidateQueries({ queryKey: trpc.sessions.draftMedia.queryKey(draftId) });

  const invalidateAttempts = () =>
    queryClient.invalidateQueries({ queryKey: trpc.uploads.listForDraft.queryKey({ draftId }) });

  const beginLocal = useMutation(trpc.uploads.beginLocal.mutationOptions()).mutateAsync;
  const finalizeLocal = useMutation(trpc.uploads.finalizeLocal.mutationOptions({
    onSuccess: () => { void invalidateDraftMedia(); void invalidateAttempts(); },
  })).mutateAsync;
  const beginDrive = useMutation(trpc.uploads.beginDrive.mutationOptions()).mutateAsync;
  const processDrive = useMutation(trpc.uploads.processDrive.mutationOptions({
    onSuccess: () => { void invalidateDraftMedia(); void invalidateAttempts(); },
  })).mutateAsync;
  const discard = useMutation(trpc.uploads.discard.mutationOptions({
    onSuccess: () => { void invalidateAttempts(); },
  })).mutateAsync;
  const discardDraft = useMutation(trpc.uploads.discardDraft.mutationOptions({
    onSuccess: () => { void invalidateDraftMedia(); void invalidateAttempts(); },
  })).mutateAsync;

  const attempts = useQuery(trpc.uploads.listForDraft.queryOptions({ draftId }));

  return {
    beginLocal,
    finalizeLocal,
    beginDrive,
    processDrive,
    discard,
    discardDraft,
    attempts: attempts.data ?? [],
    invalidateDraftMedia,
  };
}

export type UploadCommands = ReturnType<typeof useUploadCommands>;
