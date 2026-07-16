import { describe, expect, it } from 'vitest';
import {
  clusterLayer,
  clusterHaloLayer,
  iconLayer,
  unclusteredPointLayer,
  selectedSpotIconLayer,
  selectedSpotGlowLayer,
  selectedSpotPointLayer,
} from './layerStyles';

type CirclePaint = { 'circle-color'?: string; 'circle-stroke-color'?: string };
const paint = (layer: { paint?: unknown }) => layer.paint as CirclePaint;

describe('spot marker presentation', () => {
  it('draws individual spots, clusters, and the selected spot from one glass-chip material', () => {
    // The unification rule: all three marker chips share the same dark-glass fill
    // and hairline border, so they read as a single family differentiated only by
    // size and content. Drift here reintroduces the old white-vs-navy split.
    const chip = paint(unclusteredPointLayer)['circle-color'];
    const border = paint(unclusteredPointLayer)['circle-stroke-color'];

    expect(chip).toBe('rgba(51, 65, 85, 0.85)');
    expect(paint(clusterLayer)['circle-color']).toBe(chip);
    expect(paint(selectedSpotPointLayer)['circle-color']).toBe(chip);

    expect(paint(clusterLayer)['circle-stroke-color']).toBe(border);
    expect(paint(selectedSpotPointLayer)['circle-stroke-color']).toBe(border);
  });

  it('distinguishes a cluster only by a blue accent ring that grows with the count', () => {
    expect(paint(clusterHaloLayer)['circle-color']).toBe('rgba(99, 179, 237, 0.32)');
    expect(clusterHaloLayer).toMatchObject({
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['get', 'point_count'], 2, 22, 10, 25, 50, 30, 250, 35],
        'circle-blur': 0.4,
      },
    });
  });

  it('marks the selected spot with one soft blue glow, no second rim', () => {
    expect(selectedSpotGlowLayer).toMatchObject({
      paint: {
        'circle-color': 'rgba(59, 130, 246, 0.36)',
        'circle-radius': 18,
        'circle-blur': 0.75,
      },
    });
  });

  it('keeps the native blue wave glyph unchanged on ordinary and selected spots', () => {
    for (const layer of [iconLayer, selectedSpotIconLayer]) {
      expect(layer).toMatchObject({
        layout: { 'icon-image': 'custom-marker', 'icon-size': 0.105 },
      });
      // No icon-color: the glyph keeps its own blue, never tinted by the map.
      expect(layer.paint).not.toHaveProperty('icon-color');
    }
  });
});
