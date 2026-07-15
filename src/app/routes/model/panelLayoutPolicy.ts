import type { PanelRouteMode } from './panelRouteMode';

export type PanelTargetReason =
  | 'userPreference'
  | 'galleryWorkspace'
  | 'routeRequiredWorkspace'
  | 'mapInputWorkflow'
  | 'addSpotFlow';

export type RenderedPanelStateReason =
  | PanelTargetReason
  | 'waitingForFeedLayout';

export interface PanelTargetPolicyInput {
  userPreferredExpanded: boolean;
  galleryPreferredExpanded?: boolean;
  routeMode: PanelRouteMode;
  /** True while the photographer is adding a new spot over the globe. */
  isAddSpotActive: boolean;
}

export interface PanelTargetPolicy {
  expanded: boolean;
  canUserToggle: boolean;
  usesBackNavigation: boolean;
  reason: PanelTargetReason;
}

export interface RenderedPanelStateInput {
  targetExpanded: boolean;
  targetReason: PanelTargetReason;
  isFeedLayoutReady: boolean;
  canWaitForFeedLayout: boolean;
  currentRenderedExpanded: boolean;
}

export interface RenderedPanelState {
  expanded: boolean;
  reason: RenderedPanelStateReason;
}

export function derivePanelTargetPolicy({
  userPreferredExpanded,
  galleryPreferredExpanded = true,
  routeMode,
  isAddSpotActive,
}: PanelTargetPolicyInput): PanelTargetPolicy {
  if (isAddSpotActive) {
    return {
      expanded: false,
      canUserToggle: false,
      usesBackNavigation: false,
      reason: 'addSpotFlow',
    };
  }

  if (routeMode === 'workspace') {
    return {
      expanded: true,
      canUserToggle: false,
      usesBackNavigation: true,
      reason: 'routeRequiredWorkspace',
    };
  }

  if (routeMode === 'galleryWorkspace') {
    return {
      expanded: galleryPreferredExpanded,
      canUserToggle: true,
      usesBackNavigation: false,
      reason: 'galleryWorkspace',
    };
  }

  if (routeMode === 'mapInput') {
    return {
      expanded: false,
      canUserToggle: false,
      usesBackNavigation: true,
      reason: 'mapInputWorkflow',
    };
  }

  return {
    expanded: userPreferredExpanded,
    canUserToggle: true,
    usesBackNavigation: false,
    reason: 'userPreference',
  };
}

export function deriveRenderedPanelState({
  targetExpanded,
  targetReason,
  isFeedLayoutReady,
  canWaitForFeedLayout,
  currentRenderedExpanded,
}: RenderedPanelStateInput): RenderedPanelState {
  if (canWaitForFeedLayout && currentRenderedExpanded && !targetExpanded && !isFeedLayoutReady) {
    return {
      expanded: true,
      reason: 'waitingForFeedLayout',
    };
  }

  return {
    expanded: targetExpanded,
    reason: targetReason,
  };
}
