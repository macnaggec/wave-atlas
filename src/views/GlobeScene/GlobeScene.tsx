import { GlobeMap } from 'widgets/GlobeMap';
import { useMapSpots } from 'entities/Spot';
import { AddSpotPanel, usePinPlacementStore } from 'features/AddSpot';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMatches, useNavigate } from '@tanstack/react-router';
import { useCallback, useState, useSyncExternalStore } from 'react';
import type { Spot } from 'entities/Spot';
import type { LngLat } from 'shared/types/coordinates';
import { useTRPC } from 'shared/lib/trpc';
import { getErrorMessage } from 'shared/lib/getErrorMessage';
import { notify } from 'shared/lib/notifications';
import classes from './GlobeScene.module.css';
import { deriveGlobeMotionPolicy } from './model/globeMotionPolicy';
import { deriveGlobeSceneMode } from './model/globeSceneMode';

// Full world bounds — server filters by lat/lng; passes all valid spots until real viewport bounds are wired
const WORLD_BOUNDS = { swLat: -90, swLng: -180, neLat: 90, neLng: 180 };
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function subscribeDocumentVisibility(onStoreChange: () => void) {
  document.addEventListener('visibilitychange', onStoreChange);
  return () => document.removeEventListener('visibilitychange', onStoreChange);
}

function getDocumentHiddenSnapshot() {
  return document.hidden;
}

function subscribeReducedMotion(onStoreChange: () => void) {
  const mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY);

  mediaQuery.addEventListener('change', onStoreChange);
  return () => mediaQuery.removeEventListener('change', onStoreChange);
}

function getReducedMotionSnapshot() {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

function useDocumentHidden() {
  return useSyncExternalStore(
    subscribeDocumentVisibility,
    getDocumentHiddenSnapshot,
    () => false,
  );
}

function usePrefersReducedMotion() {
  return useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    () => false,
  );
}

/**
 * GlobeScene — persistent globe view with floating UI.
 *
 * Lives at layout level — never remounts on panel open/close navigations.
 */
export function GlobeScene() {
  const { data: spots = [] } = useMapSpots(WORLD_BOUNDS);
  const isPinMode = usePinPlacementStore((s) => s.isActive);
  const tempPin = usePinPlacementStore((s) => s.tempPin);
  const setTempPin = usePinPlacementStore((s) => s.setTempPin);
  const [isUserExploring, setIsUserExploring] = useState(false);
  const isDocumentHidden = useDocumentHidden();
  const prefersReducedMotion = usePrefersReducedMotion();
  const matches = useMatches();
  const navigate = useNavigate();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { mutateAsync: updateDraft, isPending: isUpdatingDraft } = useMutation(
    trpc.sessions.updateDraft.mutationOptions(),
  );
  const uploadMatch = matches.find((match) => match.routeId === '/_panel/upload');
  const draftId = uploadMatch
    ? (uploadMatch.search as { draftId?: string }).draftId
    : undefined;
  const spotMatch = matches.find((match) => match.routeId === '/_panel/$spotId');
  const selectedSpotId = (spotMatch?.params as { spotId?: string } | undefined)?.spotId ?? null;
  const sceneMode = deriveGlobeSceneMode({
    isPinPlacementActive: isPinMode,
    isUploadSpotSelectionActive: Boolean(draftId),
    selectedSpotId,
    isUserExploring,
  });
  const motionPolicy = deriveGlobeMotionPolicy({
    sceneMode,
    isDocumentHidden,
    prefersReducedMotion,
  });

  const handleSpotSelect = useCallback(async (spot: Spot) => {
    if (isUpdatingDraft) return;

    if (sceneMode.kind !== 'uploadSpotSelection' || !draftId) {
      await navigate({ to: '/$spotId', params: { spotId: spot.id } });
      return;
    }

    try {
      await updateDraft({ draftId, spotId: spot.id });
      await queryClient.invalidateQueries({ queryKey: trpc.sessions.draft.queryKey(draftId) });
    } catch (error) {
      notify.error(getErrorMessage(error), 'Unable to Save Spot');
    }
  }, [draftId, isUpdatingDraft, navigate, queryClient, sceneMode.kind, trpc, updateDraft]);

  const handleMapCoordinateClick = useCallback((coords: LngLat) => {
    setTempPin(coords);
  }, [setTempPin]);

  return (
    <div className={classes.root}>
      <GlobeMap
        spots={spots}
        selectedSpotId={selectedSpotId}
        onSpotSelect={handleSpotSelect}
        motionPolicy={motionPolicy}
        isPinPlacementActive={isPinMode}
        tempPin={tempPin}
        onMapCoordinateClick={handleMapCoordinateClick}
        onUserExploreStart={() => setIsUserExploring(true)}
        onUserExploreEnd={() => setIsUserExploring(false)}
      />
      {isUpdatingDraft && (
        <div className={classes.saveStatus} role="status">Saving spot…</div>
      )}
      {isPinMode && <AddSpotPanel />}
    </div>
  );
}
