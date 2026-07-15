import { describe, expect, it } from 'vitest';
import { derivePanelTargetPolicy, deriveRenderedPanelState } from './panelLayoutPolicy';

describe('derivePanelTargetPolicy', () => {
  it('expands a route-required workspace regardless of user preference', () => {
    expect(derivePanelTargetPolicy({
      userPreferredExpanded: false,
      routeMode: 'workspace',
      isAddSpotActive: false,
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
      isAddSpotActive: false,
    })).toEqual({
      expanded: true,
      canUserToggle: true,
      usesBackNavigation: false,
      reason: 'userPreference',
    });
  });

  it('keeps gallery expanded by default while leaving compact mode explicit', () => {
    expect(derivePanelTargetPolicy({
      userPreferredExpanded: false,
      galleryPreferredExpanded: true,
      routeMode: 'galleryWorkspace',
      isAddSpotActive: false,
    })).toEqual({
      expanded: true,
      canUserToggle: true,
      usesBackNavigation: false,
      reason: 'galleryWorkspace',
    });
  });

  it('compacts a map-input route and disables the user toggle', () => {
    expect(derivePanelTargetPolicy({
      userPreferredExpanded: true,
      routeMode: 'mapInput',
      isAddSpotActive: false,
    })).toEqual({
      expanded: false,
      canUserToggle: false,
      usesBackNavigation: true,
      reason: 'mapInputWorkflow',
    });
  });

  it('compacts the panel with no back nav throughout Add Spot', () => {
    expect(derivePanelTargetPolicy({
      userPreferredExpanded: true,
      routeMode: 'browsing',
      isAddSpotActive: true,
    })).toEqual({
      expanded: false,
      canUserToggle: false,
      usesBackNavigation: false,
      reason: 'addSpotFlow',
    });
  });

  it('prioritizes Add Spot over a route-required workspace', () => {
    expect(derivePanelTargetPolicy({
      userPreferredExpanded: false,
      routeMode: 'workspace',
      isAddSpotActive: true,
    })).toEqual({
      expanded: false,
      canUserToggle: false,
      usesBackNavigation: false,
      reason: 'addSpotFlow',
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
