import { useState, useCallback } from 'react';
import { GlobeScene } from 'views/GlobeScene';
import { LeftStrip } from 'widgets/LeftStrip/LeftStrip';
import { FeedDrawer, FeedSearch } from 'widgets/FeedDrawer';

/**
 * AppShell — always-mounted persistent UI layer.
 *
 * Owns the floating elements that live above the globe at all times:
 * the globe itself, the left nav strip, and the feed panel.
 *
 * Kept separate from __root.tsx so routing infrastructure
 * and persistent UI composition each have a single reason to change.
 */
export function AppShell() {
  const [isUploadMode, setIsUploadMode] = useState(false);
  const [feedOpen, setFeedOpen] = useState(true);

  const handleToggleUpload = useCallback((value?: boolean) => {
    setIsUploadMode((prev) => (typeof value === 'boolean' ? value : !prev));
  }, []);

  return (
    <>
      <GlobeScene />
      <LeftStrip isUploadMode={isUploadMode} onToggleUpload={handleToggleUpload} />
      <FeedDrawer
        isOpen={feedOpen && !isUploadMode}
        onToggle={() => setFeedOpen((v) => !v)}
        search={<FeedSearch />}
      />
    </>
  );
}
