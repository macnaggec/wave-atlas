import { describe, expect, it } from 'vitest';
import { deriveGlobeSceneMode } from './globeSceneMode';

describe('deriveGlobeSceneMode', () => {
  it('names pin placement before route or upload selection modes', () => {
    expect(deriveGlobeSceneMode({
      isPinPlacementActive: true,
      isUploadSpotSelectionActive: true,
      selectedSpotId: 'spot-1',
      isUserExploring: false,
    })).toEqual({ kind: 'pinPlacement' });
  });

  it('names upload spot selection before focused spot routes', () => {
    expect(deriveGlobeSceneMode({
      isPinPlacementActive: false,
      isUploadSpotSelectionActive: true,
      selectedSpotId: 'spot-1',
      isUserExploring: false,
    })).toEqual({ kind: 'uploadSpotSelection' });
  });

  it('names focused spot routes with the selected spot id', () => {
    expect(deriveGlobeSceneMode({
      isPinPlacementActive: false,
      isUploadSpotSelectionActive: false,
      selectedSpotId: 'spot-1',
      isUserExploring: false,
    })).toEqual({ kind: 'spotFocused', spotId: 'spot-1' });
  });

  it('names active map exploration before the overview mode', () => {
    expect(deriveGlobeSceneMode({
      isPinPlacementActive: false,
      isUploadSpotSelectionActive: false,
      selectedSpotId: null,
      isUserExploring: true,
    })).toEqual({ kind: 'userExploring' });
  });

  it('names the default mode as overview', () => {
    expect(deriveGlobeSceneMode({
      isPinPlacementActive: false,
      isUploadSpotSelectionActive: false,
      selectedSpotId: null,
      isUserExploring: false,
    })).toEqual({ kind: 'overview' });
  });
});
