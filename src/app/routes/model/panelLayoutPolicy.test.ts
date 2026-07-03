import { describe, expect, it } from 'vitest';
import { derivePanelTargetPolicy, deriveRenderedPanelState } from './panelLayoutPolicy';

describe('derivePanelTargetPolicy', () => {
  it('expands a route-required workspace regardless of user preference', () => {
    expect(derivePanelTargetPolicy({
      userPreferredExpanded: false,
      routeMode: 'workspace',
    })).toEqual({
      expanded: true,
      canUserToggle: false,
      usesBackNavigation: true,
      reason: 'routeRequiredWorkspace',
    });
  });

  it('follows user preference during normal browsing', () => {
    expect(derivePanelTargetPolicy({
      userPreferredExpanded: true,
      routeMode: 'browsing',
    })).toEqual({
      expanded: true,
      canUserToggle: true,
      usesBackNavigation: false,
      reason: 'userPreference',
    });
  });

  it('compacts a map-input route and disables the user toggle', () => {
    expect(derivePanelTargetPolicy({
      userPreferredExpanded: true,
      routeMode: 'mapInput',
    })).toEqual({
      expanded: false,
      canUserToggle: false,
      usesBackNavigation: true,
      reason: 'mapInputWorkflow',
    });
  });
});

describe('deriveRenderedPanelState', () => {
  it('waits for feed layout readiness before collapsing from an expanded render', () => {
    expect(deriveRenderedPanelState({
      targetExpanded: false,
      targetReason: 'userPreference',
      isFeedLayoutReady: false,
      canWaitForFeedLayout: true,
      currentRenderedExpanded: true,
    })).toEqual({
      expanded: true,
      reason: 'waitingForFeedLayout',
    });
  });

  it('does not wait for feed layout readiness before compacting a map-input route', () => {
    expect(deriveRenderedPanelState({
      targetExpanded: false,
      targetReason: 'mapInputWorkflow',
      isFeedLayoutReady: false,
      canWaitForFeedLayout: false,
      currentRenderedExpanded: true,
    })).toEqual({
      expanded: false,
      reason: 'mapInputWorkflow',
    });
  });

  it('collapses after feed layout readiness when returning to compact mode', () => {
    expect(deriveRenderedPanelState({
      targetExpanded: false,
      targetReason: 'userPreference',
      isFeedLayoutReady: true,
      canWaitForFeedLayout: true,
      currentRenderedExpanded: true,
    })).toEqual({
      expanded: false,
      reason: 'userPreference',
    });
  });
});
