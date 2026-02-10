import { useCallback, RefObject } from 'react';
import { MapRef } from 'react-map-gl';
import { getErrorMessage } from 'shared/lib/getErrorMessage';

export const useMapImages = (mapRef: RefObject<MapRef | null>) => {
  const loadImages = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;

    // Use the larger android-chrome-192x192.png for better quality on the map
    map.loadImage('/android-chrome-192x192.png', (error, image) => {
      if (error) {
        console.error('Error loading map icon:', getErrorMessage(error));
        return;
      }
      if (image && !map.hasImage('custom-marker')) {
        // Enable SDF to allow dynamic coloring via icon-color
        map.addImage('custom-marker', image, { sdf: true });
      }
    });
  }, [mapRef]);

  return { loadImages };
};
