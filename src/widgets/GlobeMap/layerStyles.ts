import { LayerProps, Fog } from 'react-map-gl';

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
    'circle-color': '#ffffff',
    'circle-opacity': 0.7, // Kinda transparent
    'circle-radius': [
      'case',
      ['==', ['get', 'id'], activeSpotId],
      14, // Active radius
      ['get', 'isUnverified'],
      8,  // Unverified radius
      14   // Default radius
    ],
    'circle-stroke-width': 1,
    'circle-stroke-color': '#ffffff',
    'circle-stroke-opacity': 0.5
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
      0.15, // Unverified
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
      '#3b82f6'  // Verified (default): Blue
    ],
    'icon-opacity': 1
  }
});


