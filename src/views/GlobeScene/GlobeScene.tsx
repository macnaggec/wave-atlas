import { GlobeMap } from 'widgets/GlobeMap';
import { useMapSpots } from 'entities/Spot';
import { AddSpotPanel, usePinPlacementStore } from 'features/AddSpot';
import classes from './GlobeScene.module.css';

// Full world bounds — server filters by lat/lng; passes all valid spots until real viewport bounds are wired
const WORLD_BOUNDS = { swLat: -90, swLng: -180, neLat: 90, neLng: 180 };

/**
 * GlobeScene — persistent globe view with floating UI.
 *
 * Lives at layout level — never remounts on panel open/close navigations.
 */
export function GlobeScene() {
  const { data: spots = [] } = useMapSpots(WORLD_BOUNDS);
  const isPinMode = usePinPlacementStore((s) => s.isActive);

  return (
    <div className={classes.root}>
      <GlobeMap spots={spots} />
      {isPinMode && <AddSpotPanel />}
    </div>
  );
}
