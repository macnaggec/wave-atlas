import { describe, expect, it } from 'vitest';
import { deriveAppChromePolicy } from './appChromePolicy';

describe('deriveAppChromePolicy', () => {
  it('shows ordinary app chrome when no immersive flow is active', () => {
    expect(deriveAppChromePolicy({ isAddSpotActive: false })).toEqual({
      showLeftStrip: true,
      showSidePanel: true,
      showFloatingPanelControls: true,
      showMapNavigationControl: true,
      reason: 'default',
    });
  });

  it('hides unrelated chrome while Add Spot is active', () => {
    expect(deriveAppChromePolicy({ isAddSpotActive: true })).toEqual({
      showLeftStrip: false,
      showSidePanel: false,
      showFloatingPanelControls: false,
      showMapNavigationControl: false,
      reason: 'addSpotFlow',
    });
  });

  it('hides the left strip on full-page overlay routes', () => {
    expect(deriveAppChromePolicy({ isAddSpotActive: false, isFullPageRouteActive: true })).toEqual({
      showLeftStrip: false,
      showSidePanel: true,
      showFloatingPanelControls: true,
      showMapNavigationControl: true,
      reason: 'fullPageRoute',
    });
  });
});
