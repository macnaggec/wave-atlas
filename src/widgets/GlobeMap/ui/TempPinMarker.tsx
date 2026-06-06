import { Marker } from 'react-map-gl';
import { usePinPlacementStore } from 'features/AddSpot';
import classes from '../GlobeMap.module.css';

export function TempPinMarker() {
  const tempPin = usePinPlacementStore((s) => s.tempPin);
  const isActive = usePinPlacementStore((s) => s.isActive);

  if (!tempPin || !isActive) return null;

  return (
    <Marker longitude={tempPin[0]} latitude={tempPin[1]} anchor="center">
      <div className={classes.tempPin} />
    </Marker>
  );
}
