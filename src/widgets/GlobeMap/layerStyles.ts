import { LayerProps, Fog } from 'react-map-gl';

// Mapbox paint specs take plain JS, not CSS custom properties, so these are
// kept as local constants in sync with tokens.css.
const ACCENT_MARKER = '#3b82f6';
// Same glass family as --wa-surface-chrome / --wa-glass-border-chrome (the
// popup background, materials.module.css .chrome), but boosted in opacity:
// popups sit on a blurred backdrop-filter, while this is a flat canvas
// circle with no blur, so it needs more alpha to read against the globe.
const MARKER_SUBSTRATE_COLOR = 'rgba(255, 255, 255, 0.32)';
const MARKER_SUBSTRATE_BORDER = 'rgba(255, 255, 255, 0.4)';

export const SPOT_INTERACTIVE_LAYERS: string[] = [
  'clusters',
  'unclustered-point',
  'unclustered-point-icon',
  'selected-spot-point',
  'selected-spot-icon',
];

export const globeFog: Fog = {
  color: 'rgb(186, 210, 235)',
  'high-color': 'rgb(36, 92, 223)',
  'horizon-blend': 0.02,
  'space-color': 'rgb(10, 22, 40)',
  'star-intensity': 0.6,
};

export const clusterLayer: LayerProps = {
  id: 'clusters',
  type: 'circle',
  source: 'spots',
  filter: ['has', 'point_count'],
  paint: {
    'circle-color': '#51bbd6',
    'circle-radius': [
      'step',
      ['get', 'point_count'],
      15, // radius for count < 100
      100, // step point
      20, // radius for count >= 100
      750, // step point
      25  // radius for count >= 750
    ],
    'circle-stroke-width': 2,
    'circle-stroke-color': '#fff'
  }
};

export const clusterCountLayer: LayerProps = {
  id: 'cluster-count',
  type: 'symbol',
  source: 'spots',
  filter: ['has', 'point_count'],
  layout: {
    'text-field': '{point_count_abbreviated}',
    'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
    'text-size': 12
  },
  paint: {
    'text-color': '#ffffff'
  }
};

export const getUnclusteredPointLayer = (activeSpotId: string | number | null): LayerProps => ({
  id: 'unclustered-point',
  type: 'circle',
  source: 'spots',
  filter: ['!', ['has', 'point_count']],
  paint: {
    'circle-color': MARKER_SUBSTRATE_COLOR,
    'circle-radius': [
      'case',
      ['==', ['get', 'id'], activeSpotId],
      14, // Active radius
      14   // Default radius (verified + unverified)
    ],
    'circle-stroke-width': 1,
    'circle-stroke-color': MARKER_SUBSTRATE_BORDER
  }
});

export const getIconLayer = (activeSpotId: string | number | null): LayerProps => ({
  id: 'unclustered-point-icon',
  type: 'symbol',
  source: 'spots',
  filter: ['!', ['has', 'point_count']],
  layout: {
    'icon-image': 'custom-marker',
    // Dynamic sizing
    'icon-size': [
      'case',
      ['==', ['get', 'id'], activeSpotId],
      0.12, // Active
      ['get', 'isUnverified'],
      0.12, // Unverified
      0.12   // Default
    ],
    'icon-allow-overlap': true,
    'icon-ignore-placement': true
  },
  paint: {
    'icon-color': [
      'case',
      ['==', ['get', 'id'], activeSpotId],
      '#f59e0b', // Active: Orange
      ['get', 'isUnverified'],
      '#9ca3af', // Unverified: Grey
      ACCENT_MARKER  // Verified (default): Blue
    ],
    'icon-opacity': 1
  }
});

// Selected spot lives in its own always-unclustered source (see GlobeMapComponent),
// so it stays individually visible instead of being folded into a cluster while
// zooming out — which would otherwise leave its popup pointing at a cluster.
export const selectedSpotPointLayer: LayerProps = {
  id: 'selected-spot-point',
  type: 'circle',
  source: 'selected-spot',
  paint: {
    'circle-color': MARKER_SUBSTRATE_COLOR,
    'circle-radius': 14,
    'circle-stroke-width': 1,
    'circle-stroke-color': MARKER_SUBSTRATE_BORDER
  }
};

export const selectedSpotIconLayer: LayerProps = {
  id: 'selected-spot-icon',
  type: 'symbol',
  source: 'selected-spot',
  layout: {
    'icon-image': 'custom-marker',
    'icon-size': 0.12,
    'icon-allow-overlap': true,
    'icon-ignore-placement': true
  },
  paint: {
    'icon-color': '#f59e0b', // Active: Orange — this source only ever holds the selected spot
    'icon-opacity': 1
  }
};


