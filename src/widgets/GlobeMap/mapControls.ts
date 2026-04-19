import type { PageMode } from './GlobeMapComponent';

interface MapControlsConfig {
  dragPan: boolean;
  dragRotate: boolean;
  scrollZoom: boolean;
  touchPitch: boolean;
  touchZoomRotate: boolean;
  doubleClickZoom: boolean;
  keyboard: boolean;
}

/**
 * Returns map interaction control flags based on current app state.
 *
 * Centralises lock logic so GlobeMapComponent is closed for modification
 * when new lock conditions are added (e.g. upload mode, modal open).
 */
export function getMapControls(
  activeSpotId: string | null,
  _mode: PageMode
): MapControlsConfig {
  const locked = !!activeSpotId;

  return {
    dragPan: !locked,
    dragRotate: !locked,
    scrollZoom: !locked,
    touchPitch: !locked,
    touchZoomRotate: !locked,
    doubleClickZoom: !locked,
    keyboard: !locked,
  };
}
