import { PANEL_WIDTH_VW } from 'shared/model/panelExpansionStore';

export interface GlobeSidebarOcclusionInput {
  isRenderedPanelExpanded: boolean;
  viewportWidthPx: number;
}

/** How many px of the right edge of the viewport the panel currently occludes — used to keep the camera centering a selected spot within the visible (non-occluded) part of the map. */
export function deriveGlobeSidebarOcclusionPx({
  isRenderedPanelExpanded,
  viewportWidthPx,
}: GlobeSidebarOcclusionInput): number {
  const widthVw = isRenderedPanelExpanded ? PANEL_WIDTH_VW.expanded : PANEL_WIDTH_VW.compact;
  return viewportWidthPx * widthVw / 100;
}
