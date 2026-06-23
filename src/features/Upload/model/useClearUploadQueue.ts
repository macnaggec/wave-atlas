import { useCallback } from 'react';
import { useUploadStore } from './uploadStore';
import { revokeBlobUrl } from './types';

/**
 * Post-publish cleanup. Releases browser-only resources (blob URLs, XHR aborts).
 * Does NOT call the server — the publish policy ensures no nonterminal attempts remain.
 */
export function useClearUploadQueue() {
  return useCallback(() => {
    const transfers = useUploadStore.getState().getAll();
    transfers.forEach(t => {
      if (t.source === 'local') {
        if (t.abort) try { t.abort(); } catch { /* expected */ }
        revokeBlobUrl(t.previewUrl);
      }
    });
    useUploadStore.getState().clearTransfers();
  }, []);
}
