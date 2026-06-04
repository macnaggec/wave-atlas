import { useEffect } from 'react';

/**
 * Registers a `beforeunload` browser warning when active uploads are in progress.
 *
 * The warning fires ONLY on real browser unload events:
 *   - Tab / window close
 *   - Hard refresh (F5 / Ctrl+R)
 *   - Navigating to an external URL
 *
 * It does NOT fire on client-side navigation (router.navigate) because TanStack
 * Router uses the History API (pushState), which never triggers `beforeunload`.
 * SidePanel.handleClose therefore uses router.navigate to ensure closing the panel
 * is always a safe SPA transition.
 */
export function useUploadWarning(hasActiveUploads: boolean): void {
  useEffect(() => {
    if (!hasActiveUploads) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
      return 'Uploads in progress will be cancelled. Are you sure you want to leave?';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasActiveUploads]);
}
