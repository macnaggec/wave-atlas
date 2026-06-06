import { useCallback } from 'react';
import type { MapMouseEvent } from 'react-map-gl';
import { usePinPlacementStore } from 'features/AddSpot';

export interface PinPlacementModeResult {
  onClick: (e: MapMouseEvent) => void;
  cursor: string;
}

export function usePinPlacementMode(): PinPlacementModeResult {
  const setTempPin = usePinPlacementStore((s) => s.setTempPin);

  const onClick = useCallback(
    (e: MapMouseEvent) => setTempPin([e.lngLat.lng, e.lngLat.lat]),
    [setTempPin],
  );

  return { onClick, cursor: 'crosshair' };
}
