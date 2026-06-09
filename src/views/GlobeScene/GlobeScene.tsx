import { GlobeMap } from 'widgets/GlobeMap';
import { useSpots } from 'entities/Spot';
import { AddSpotPanel, usePinPlacementStore } from 'features/AddSpot';
import classes from './GlobeScene.module.css';

/**
 * GlobeScene — persistent globe view with floating UI.
 *
 * Lives at layout level — never remounts on panel open/close navigations.
 */
export function GlobeScene() {
  const { data: spots = [] } = useSpots();
  const isPinMode = usePinPlacementStore((s) => s.isActive);

  return (
    <div className={classes.root}>
      <GlobeMap spots={spots} />
      {isPinMode && <AddSpotPanel />}
    </div>
  );
}
