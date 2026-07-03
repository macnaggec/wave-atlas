import type { PanelRouteMode } from './panelRouteMode';

export type PanelTargetReason =
  | 'userPreference'
  | 'routeRequiredWorkspace'
  | 'mapInputWorkflow';

export type RenderedPanelStateReason =
  | PanelTargetReason
  | 'waitingForFeedLayout';

export interface PanelTargetPolicyInput {
  userPreferredExpanded: boolean;
  routeMode: PanelRouteMode;
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
  routeMode,
}: PanelTargetPolicyInput): PanelTargetPolicy {
  if (routeMode === 'workspace') {
    return {
      expanded: true,
      canUserToggle: false,
      usesBackNavigation: true,
      reason: 'routeRequiredWorkspace',
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
