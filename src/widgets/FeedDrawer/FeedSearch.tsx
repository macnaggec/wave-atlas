import { useCallback } from 'react';
import type { ReactNode } from 'react';
import { Button, Text } from '@mantine/core';
import SpotSearch from 'features/SpotSearch/SpotSearch';
import { useMapStore } from 'widgets/GlobeMap/model/mapStore';
import { useAddSpot } from 'features/AddSpot';
import { useUser } from 'shared/hooks/useUser';
import { useAuthModal } from 'features/Auth/AuthModalProvider';
import type { Spot } from 'entities/Spot/types';

export function FeedSearch() {
  const selectSpot = useMapStore((s) => s.selectSpot);
  const { startAddSpot } = useAddSpot();
  const { isAuthenticated } = useUser();
  const { open: openAuthModal } = useAuthModal();

  const handleSelect = useCallback((spot: Spot) => selectSpot(spot), [selectSpot]);

  const emptyAction = useCallback(
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

  return <SpotSearch onSpotSelect={handleSelect} emptyAction={emptyAction} />;
}
