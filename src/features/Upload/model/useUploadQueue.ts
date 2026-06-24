import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTRPC } from 'shared/lib/trpc';
import { useUploadStore } from './uploadStore';
import type { AttemptCard, DraftCard, GalleryCard } from './types';
import type { UploadAttemptProjection } from 'shared/types/upload';

export function useUploadQueue(draftId: string) {
  const trpc = useTRPC();
  const { data: attempts = [] } = useQuery(trpc.uploads.listForDraft.queryOptions({ draftId }));
  const { data: draftMedia = [] } = useQuery(trpc.sessions.draftMedia.queryOptions(draftId));
  const transferMap = useUploadStore(s => s.transfers);

  const queue = useMemo<GalleryCard[]>(() => {
    const transfers = Array.from(transferMap.values());
    const cards: GalleryCard[] = [];
    const attemptIdsSeen = new Set<string>();

    // Attempt cards: merge server attempt projection with browser transfer.
    for (const attempt of attempts as UploadAttemptProjection[]) {
      attemptIdsSeen.add(attempt.id);
      const transfer = transfers.find(t => t.attemptId === attempt.id);
      const localError = transfer?.source === 'local' ? transfer.error : undefined;
      const card: AttemptCard = {
        kind: 'attempt',
        id: attempt.id,
        source: attempt.source,
        status: localError ? 'FAILED' : attempt.status,
        previewUrl: transfer?.previewUrl ?? '',
        progress: transfer?.source === 'local' ? transfer.progress : undefined,
        errorCode: localError ?? attempt.errorCode ?? undefined,
      };
      cards.push(card);
    }

    // Browser-only transfers that have no server attempt yet (pending window).
    for (const t of transfers) {
      if (t.attemptId && attemptIdsSeen.has(t.attemptId)) continue;
      const localError = t.source === 'local' ? t.error : undefined;
      const card: AttemptCard = {
        kind: 'attempt',
        id: t.clientRequestId,
        source: t.source.toUpperCase() as AttemptCard['source'],
        status: localError ? 'FAILED' : 'pending',
        previewUrl: t.previewUrl,
        progress: t.source === 'local' ? t.progress : undefined,
        errorCode: localError,
      };
      cards.push(card);
    }

    // Draft cards: completed media items from server.
    for (const media of draftMedia) {
      const card: DraftCard = { kind: 'draft', id: media.id, result: media };
      cards.push(card);
    }

    return cards;
  }, [attempts, draftMedia, transferMap]);

  const hasActiveUploads = queue.some(
    c => c.kind === 'attempt' && ['pending', 'READY', 'ACQUIRING', 'FINALIZING'].includes(c.status),
  );

  const selectableItems = queue.filter(
    c => c.kind === 'draft' || (c.kind === 'attempt' && c.status === 'COMPLETED'),
  );

  return { queue, hasActiveUploads, selectableItems };
}
