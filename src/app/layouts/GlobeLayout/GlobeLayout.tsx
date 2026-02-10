import { ReactNode, forwardRef } from 'react';

import { Spot } from 'entities/Spot/types';
import { GlobeMap } from 'widgets/GlobeMap';
import { GlobeMapHandle, PageMode } from 'widgets/GlobeMap/GlobeMapComponent';
import classes from './GlobeLayout.module.css';

export interface GlobeLayoutProps {
  children?: ReactNode;
  spots?: Spot[];
  selectedSpotId?: string | null;
  onSpotSelect?: (spot: Spot) => void;
  mode?: PageMode;
  /** Content for the top bar (search, user menu) */
  topBarContent?: ReactNode;
  /** Content for the bottom bar */
  bottomBarContent?: ReactNode;
  /** Callbacks for upload mode */
  onUploadConfirm?: (spot: Spot) => void;
  onUploadCancel?: () => void;
  /** Callback when preview popup closes */
  onClosePreview?: () => void;
}

/**
 * GlobeLayout - Fullscreen globe-centric layout
 *
 * Renders the 3D globe as the base layer with floating UI elements above it.
 * All UI is positioned with fixed positioning and proper z-index layering.
 *
 * Z-Index Hierarchy:
 * - Globe: var(--z-globe, 0)
 * - Floating controls: var(--z-controls, 100)
 * - Panels/drawers: var(--z-panels, 200)
 * - Modals: var(--z-modals, 500)
 * - Notifications: 1000 (Mantine default)
 */
export default function GlobeLayout({
  children,
  spots = [],
  selectedSpotId,
  onSpotSelect,
  mode = 'explore',
  topBarContent,
  bottomBarContent,
  onUploadConfirm,
  onUploadCancel,
  onClosePreview,
}: GlobeLayoutProps) {
  return (
    <div className={classes.root}>
      {/* Base layer: 3D Globe */}
      <GlobeMap
        spots={spots}
        selectedSpotId={selectedSpotId}
        onSpotSelect={onSpotSelect}
        mode={mode}
        onUploadConfirm={onUploadConfirm}
        onUploadCancel={onUploadCancel}
        onClosePreview={onClosePreview}
      />

      {/* Floating controls layer */}
      <div className={classes.floatingControls}>
        {topBarContent && (
          <div className={classes.topBar}>
            {topBarContent}
          </div>
        )}

        {bottomBarContent && (
          <div className={classes.bottomBar}>
            {bottomBarContent}
          </div>
        )}
      </div>

      {/* Panels layer - for children like spot details, cart, etc. */}
      <div className={classes.panelsLayer}>
        {children}
      </div>
    </div>
  );
}
