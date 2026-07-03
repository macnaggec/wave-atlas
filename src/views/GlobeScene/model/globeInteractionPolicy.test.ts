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
    })).toBe('background');
  });

  it('backgrounds focused spot navigation while the panel is expanded', () => {
    expect(deriveGlobeInteractionPolicy({
      sceneMode: { kind: 'spotFocused', spotId: 'spot-1' },
      isRenderedPanelExpanded: true,
    })).toBe('background');
  });

  it.each([
    { kind: 'pinPlacement' },
    { kind: 'uploadSpotSelection' },
  ] as const)('keeps intentional map mode $kind interactive while the panel is expanded', (sceneMode) => {
    expect(deriveGlobeInteractionPolicy({
      sceneMode,
      isRenderedPanelExpanded: true,
    })).toBe('interactive');
  });
});
