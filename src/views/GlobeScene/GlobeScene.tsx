import { GlobeMap } from 'widgets/GlobeMap';
import { useMapStore } from 'widgets/GlobeMap/model/mapStore';
import { useSpots } from 'entities/Spot/model/useSpots';
import { AddSpotPanel } from 'features/AddSpot';
import classes from './GlobeScene.module.css';

/**
 * GlobeScene — persistent globe view with floating UI.
 *
 * Lives at layout level — never remounts on panel open/close navigations.
 */
export function GlobeScene() {
  const { data: spots = [] } = useSpots();
  const isPinMode = useMapStore((s) => s.interactionMode === 'pin-placement');

  return (
    <div className={classes.root}>
      <GlobeMap spots={spots} />
      {isPinMode && <AddSpotPanel />}
    </div>
  );
}
