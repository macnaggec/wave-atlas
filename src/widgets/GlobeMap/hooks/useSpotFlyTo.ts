import { useCallback, useEffect, RefObject } from 'react';
import type { MapRef } from 'react-map-gl';
import { Spot } from 'entities/Spot/types';
import { useMapStore } from 'widgets/GlobeMap/model/mapStore';
import { useRouterState } from '@tanstack/react-router';

interface UseSpotFlyToProps {
  mapRef: RefObject<MapRef | null>;
  spots: Spot[];
  isLoaded: boolean;
  onUserInteractionStart: () => void;
}

/**
 * Manages camera behaviour driven by spot selection state.
 *
 * - Reads selectedSpotId from the map store (no prop threading).
 * - Flies to the selected spot with padding to clear the popup.
 * - Resets camera padding when selection is cleared.
 * - Exposes resetPreviewOffset for callers that need to trigger it imperatively
 *   (e.g. popup close button before the store clears).
 */
export function useSpotFlyTo({
  mapRef,
  spots,
  isLoaded,
  onUserInteractionStart,
}: UseSpotFlyToProps) {
  const activeSpotId = useMapStore((s) => s.selectedSpotId);
  const clearSelection = useMapStore((s) => s.clearSelection);

  // Close popup when the drawer opens (URL has a $spotId param).
  const panelOpen = useRouterState({
    select: (s) => s.matches.some((m) => 'spotId' in (m.params ?? {})),
  });
  useEffect(() => {
    if (panelOpen) clearSelection();
  }, [panelOpen, clearSelection]);

  const resetPreviewOffset = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;

    const center = map.getCenter();
    map.easeTo({
      center,
      padding: { top: 0 },
      duration: 600,
    });
  }, [mapRef]);

  useEffect(() => {
    if (!isLoaded) return;

    if (!activeSpotId) {
      resetPreviewOffset();
      return;
    }

    const spot = spots.find((s) => s.id === activeSpotId);
    if (!spot || !mapRef.current) return;

    const map = mapRef.current.getMap();
    map.flyTo({
      center: [spot.coords[1], spot.coords[0]],
      zoom: Math.max(map.getZoom(), 12),
      padding: { top: 300 },
      duration: 600,
      essential: true,
    });

    onUserInteractionStart();
  }, [activeSpotId, spots, isLoaded, resetPreviewOffset, onUserInteractionStart]);

  return { resetPreviewOffset };
}
