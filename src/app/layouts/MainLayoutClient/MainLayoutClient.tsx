'use client';

import { ReactNode, useState } from 'react';
import { GlobeLayout } from 'app/layouts/GlobeLayout';
import SpotSearch from 'widgets/SpotSearch/SpotSearch';
import { Spot } from 'entities/Spot/types';
import classes from './MainLayoutClient.module.css';

interface MainLayoutClientProps {
  children: ReactNode;
  spots: Spot[];
}

/**
 * MainLayoutClient - Client wrapper for the main layout
 *
 * Manages interactions between search bar and the globe map.
 * Uses state with timestamp to ensure re-triggering on same spot selection.
 */
export function MainLayoutClient({ children, spots }: MainLayoutClientProps) {
  const [selectedSpotId, setSelectedSpotId] = useState<string | null>(null);

  const handleSpotSelect = (spot: Spot) => {
    setSelectedSpotId(spot.id);
  };

  const handleMapSpotClick = (spot: Spot) => {
    // Same handler for both search and map clicks - single source of truth
    setSelectedSpotId(spot.id);
  };

  const handleClosePreview = () => {
    // Reset to null so re-selecting the same spot will trigger state change
    setSelectedSpotId(null);
  };

  return (
    <GlobeLayout
      spots={spots}
      selectedSpotId={selectedSpotId}
      onSpotSelect={handleMapSpotClick}
      onClosePreview={handleClosePreview}
      topBarContent={
        <div className={classes.searchBar}>
          <SpotSearch onSpotSelect={handleSpotSelect} />
        </div>
      }
    >
      {children}
    </GlobeLayout>
  );
}
