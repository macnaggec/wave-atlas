import { useMemo } from 'react';
import type { FeatureCollection } from 'geojson';
import { Spot } from 'entities/Spot/types';
import { SPOT_STATUS } from 'entities/Spot/constants';

export const useSpotGeoJson = (spots: Spot[]): FeatureCollection => {
  return useMemo(() => {
    return {
      type: 'FeatureCollection',
      features: spots.map(spot => ({
        type: 'Feature',
        properties: {
          ...spot,
          isUnverified: spot.status === SPOT_STATUS.UNVERIFIED
        },
        geometry: {
          type: 'Point',
          coordinates: [spot.coords[1], spot.coords[0]] // [lng, lat]
        }
      }))
    };
  }, [spots]);
};
