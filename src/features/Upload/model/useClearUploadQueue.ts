import { useCallback } from 'react';
import { useUploadStore } from './uploadStore';

/**
 * Post-publish queue cleanup — stub pending Task 16 rewrite.
 * Clears browser transfer store; full cleanup logic will be restored in Task 16.
 */
export function useClearUploadQueue() {
  return useCallback(() => {
    useUploadStore.getState().clearTransfers();
  }, []);
}
