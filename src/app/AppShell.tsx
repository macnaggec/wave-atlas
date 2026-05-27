import { Suspense, useState, useCallback } from 'react';
import { GlobeScene } from 'views/GlobeScene';
import { LeftStrip } from 'widgets/LeftStrip/LeftStrip';
import { SidePanel } from 'widgets/SidePanel';
import { ModeSwitcher } from 'widgets/SidePanel/ModeSwitcher';
import { FeedSearch } from 'widgets/FeedDrawer';
import { UploadIndicatorAffix } from 'features/Upload';
import { UploadSidebar } from 'features/Upload/ui/UploadSidebar';
import { SessionFeed } from 'widgets/SidePanel/SessionFeed';

/**
 * AppShell — always-mounted persistent UI layer.
 *
 * Panel state:
 *   panelOpen  — whether the right-side panel is visible (false = tongue shown)
 *   expanded   — whether the panel is stretched wide (left chevron toggled)
 *   uploadMode — true while the upload flow is active (replaces feed in panel)
 */
export function AppShell() {
  const [panelOpen, setPanelOpen] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [uploadMode, setUploadMode] = useState(false);

  const handleOpen = useCallback(() => setPanelOpen(true), []);
  const handleExpandToggle = useCallback(() => setExpanded((e) => !e), []);
  const handleModeToggle = useCallback(() => setUploadMode((m) => !m), []);

  const handleClose = useCallback(() => {
    setPanelOpen(false);
    setUploadMode(false);
  }, []);

  return (
    <>
      <div inert={expanded || undefined}>
        <GlobeScene />
      </div>
      <Suspense>
        <UploadIndicatorAffix />
      </Suspense>

      <LeftStrip />

      <SidePanel
        isOpen={panelOpen}
        onOpen={handleOpen}
        onClose={handleClose}
        expanded={expanded}
        onExpandToggle={handleExpandToggle}
        tongueLabel="Feed"
        header={<ModeSwitcher uploadMode={uploadMode} onToggle={handleModeToggle} />}
        subheader={uploadMode ? undefined : <FeedSearch />}
      >
        {uploadMode ? <UploadSidebar /> : <SessionFeed />}
      </SidePanel>
    </>
  );
}
