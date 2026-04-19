import { useCallback } from 'react';
import type { MapMouseEvent } from 'react-map-gl';
import { useMapStore } from 'widgets/GlobeMap/model/mapStore';

export interface PinPlacementModeResult {
  onClick: (e: MapMouseEvent) => void;
  cursor: string;
}

export function usePinPlacementMode(): PinPlacementModeResult {
  const setTempPin = useMapStore((s) => s.setTempPin);

  const onClick = useCallback(
    (e: MapMouseEvent) => setTempPin([e.lngLat.lng, e.lngLat.lat]),
    [setTempPin],
  );

  return { onClick, cursor: 'crosshair' };
}
