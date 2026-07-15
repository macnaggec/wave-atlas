import { describe, expect, it } from 'vitest';
import { deriveGlobeInteractionPolicy } from './globeInteractionPolicy';

describe('deriveGlobeInteractionPolicy', () => {
  it('keeps the globe interactive while the panel is compact', () => {
    expect(deriveGlobeInteractionPolicy({
      sceneMode: { kind: 'overview' },
      isRenderedPanelExpanded: false,
    })).toBe('interactive');
  });

  it('backgrounds normal globe exploration while the panel is expanded', () => {
    expect(deriveGlobeInteractionPolicy({
      sceneMode: { kind: 'overview' },
      isRenderedPanelExpanded: true,
      canCompactPanelFromMap: false,
    })).toBe('background');
  });

  it('keeps the globe interactive when map exploration can compact the expanded panel', () => {
    expect(deriveGlobeInteractionPolicy({
      sceneMode: { kind: 'overview' },
      isRenderedPanelExpanded: true,
      canCompactPanelFromMap: true,
    })).toBe('interactive');
  });

  it('backgrounds focused spot navigation while the panel is expanded', () => {
    expect(deriveGlobeInteractionPolicy({
      sceneMode: { kind: 'spotFocused', spotId: 'spot-1' },
      isRenderedPanelExpanded: true,
    })).toBe('background');
  });

  it.each([
    { kind: 'addSpotFlow' },
    { kind: 'uploadSpotSelection' },
  ] as const)('keeps intentional map mode $kind interactive while the panel is expanded', (sceneMode) => {
    expect(deriveGlobeInteractionPolicy({
      sceneMode,
      isRenderedPanelExpanded: true,
    })).toBe('interactive');
  });
});
