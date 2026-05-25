import { Suspense, useState, useCallback } from 'react';
import { GlobeScene } from 'views/GlobeScene';
import { LeftStrip } from 'widgets/LeftStrip/LeftStrip';

type PanelMode = 'closed' | 'feed' | 'upload';
import { SidePanel } from 'widgets/SidePanel';
import { FeedSearch } from 'widgets/FeedDrawer';
import { UploadIndicatorAffix } from 'features/Upload';

/**
 * AppShell — always-mounted persistent UI layer.
 *
 * Panel state is a single enum:
 *   'closed'  — panel hidden, tongue visible
 *   'feed'    — 380px panel with spot search
 *   'upload'  — expanded panel with upload surface
 *
 * Transitions:
 *   Explore button      → 'feed'   (always opens the feed)
 *   Upload button       → 'upload'
 *   Panel back arrow    → 'feed'   (from upload)
 *   Panel close chevron → 'closed' (from feed)
 *   Tongue tab          → 'feed'
 */
export function AppShell() {
  const [mode, setMode] = useState<PanelMode>('feed');

  const handlePanelToggle = useCallback(() => {
    setMode((m) => {
      if (m === 'upload') return 'feed';
      if (m === 'feed') return 'closed';
      return 'feed'; // closed → tongue was clicked
    });
  }, []);

  return (
    <>
      <GlobeScene />
      <Suspense>
        <UploadIndicatorAffix />
      </Suspense>

      <LeftStrip
        mode={mode}
        onModeChange={setMode}
      />

      <SidePanel
        isOpen={mode !== 'closed'}
        onToggle={handlePanelToggle}
        expanded={mode === 'upload'}
        header={mode === 'feed' ? <FeedSearch /> : undefined}
        tongueLabel="Feed"
        backLabel={mode === 'upload' ? 'Feed' : undefined}
      >
        {mode === 'upload' && (
          <div style={{ color: 'white', padding: 24 }}>Upload UI — coming soon</div>
        )}
      </SidePanel>
    </>
  );
}
