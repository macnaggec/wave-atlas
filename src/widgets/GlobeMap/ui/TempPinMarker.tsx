import { Marker } from 'react-map-gl';
import { useMapStore } from 'widgets/GlobeMap/model/mapStore';
import classes from '../GlobeMap.module.css';

export function TempPinMarker() {
  const tempPin = useMapStore((s) => s.tempPin);
  const isPinMode = useMapStore((s) => s.interactionMode === 'pin-placement');

  if (!tempPin || !isPinMode) return null;

  return (
    <Marker longitude={tempPin[0]} latitude={tempPin[1]} anchor="center">
      <div className={classes.tempPin} />
    </Marker>
  );
}
