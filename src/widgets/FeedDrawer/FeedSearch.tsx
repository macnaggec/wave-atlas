import { useCallback } from 'react';
import type { ReactNode } from 'react';
import { Button, Text } from '@mantine/core';
import SpotSearch from 'features/SpotSearch/SpotSearch';
import { mapCommands } from 'widgets/GlobeMap/model/mapCommands';
import { useAddSpot } from 'features/AddSpot';
import { useUser } from 'shared/hooks/useUser';
import { useAuthModal } from 'features/Auth/AuthModalProvider';
import type { Spot } from 'entities/Spot';

interface FeedSearchProps {
  placeholder?: string;
  onSpotSelect?: (spot: Spot) => void;
  /** When provided, overrides mapStore.selection for chip display. */
  activeSpot?: Spot | null;
  /** When provided, overrides the default mapCommands.clearAll() on chip clear. */
  onClear?: () => void;
  autoFocus?: boolean;
}

export function FeedSearch({ placeholder, onSpotSelect, activeSpot: activeSpotOverride, onClear, autoFocus }: FeedSearchProps = {}) {
  const selection = activeSpotOverride ?? null;
  const { startAddSpot } = useAddSpot();
  const { isAuthenticated } = useUser();
  const { open: openAuthModal } = useAuthModal();

  const handleSelect = useCallback((spot: Spot) => {
    if (onSpotSelect) {
      onSpotSelect(spot);
    } else {
      mapCommands.selectFromSearch(spot);
    }
  }, [onSpotSelect]);

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

  return (
    <SpotSearch
      onSpotSelect={handleSelect}
      emptyAction={emptyAction}
      placeholder={placeholder}
      onClear={onClear ?? (() => mapCommands.clearAll())}
      activeSpot={selection}
      autoFocus={autoFocus}
    />
  );
}
