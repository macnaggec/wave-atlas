import { useCallback } from 'react';
import type { ReactNode } from 'react';
import { Button, Text } from '@mantine/core';
import { GlobeMap } from 'widgets/GlobeMap';
import { Header } from 'widgets/Header';
import { useMapStore } from 'widgets/GlobeMap/model/mapStore';
import { useSpots } from 'entities/Spot/model/useSpots';
import type { Spot } from 'entities/Spot/types';
import { useAddSpot, AddSpotPanel } from 'features/AddSpot';
import { useUser } from 'shared/hooks/useUser';
import { useAuthModal } from 'features/Auth/AuthModalProvider';
import classes from './GlobeScene.module.css';

/**
 * GlobeScene — persistent globe view with floating UI.
 *
 * Fetches spots via TanStack Query (replaces RSC GlobeSceneLoader).
 * Lives at layout level — never remounts on panel open/close navigations.
 */
export function GlobeScene() {
  const { data: spots = [] } = useSpots();
  const selectSpot = useMapStore((s) => s.selectSpot);
  const isPinMode = useMapStore((s) => s.interactionMode === 'pin-placement');
  const handleSpotSearch = useCallback((spot: Spot) => selectSpot(spot), [selectSpot]);

  const { startAddSpot } = useAddSpot();
  const { isAuthenticated } = useUser();
  const { open: openAuthModal } = useAuthModal();

  const searchEmptyAction = useCallback(
    (search: string): ReactNode => {
      if (isAuthenticated) {
        return (
          <Button variant="subtle" size="sm" onClick={() => startAddSpot(search)}>
            Add as a new spot
          </Button>
        );
      }
      return (
        <Text size="sm" c="dimmed" style={{ cursor: 'pointer' }} onClick={openAuthModal}>
          Sign in to add as a new spot
        </Text>
      );
    },
    [isAuthenticated, startAddSpot, openAuthModal],
  );

  return (
    <div className={classes.root}>
      <GlobeMap spots={spots} />

      <div className={classes.floatingControls}>
        {isPinMode ? (
          <AddSpotPanel />
        ) : (
          <Header onSpotSelect={handleSpotSearch} searchEmptyAction={searchEmptyAction} />
        )}
      </div>
    </div>
  );
}
