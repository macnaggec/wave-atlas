import { GlobeMap } from 'widgets/GlobeMap';
import { useMapSpots } from 'entities/Spot';
import { AddSpotPanel, usePinPlacementStore } from 'features/AddSpot';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMatches, useNavigate } from '@tanstack/react-router';
import { useCallback } from 'react';
import type { Spot } from 'entities/Spot';
import { useTRPC } from 'shared/lib/trpc';
import { getErrorMessage } from 'shared/lib/getErrorMessage';
import { notify } from 'shared/lib/notifications';
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

  const handleSpotSelect = useCallback(async (spot: Spot) => {
    if (isUpdatingDraft) return;
    if (!draftId) {
      await navigate({ to: '/$spotId', params: { spotId: spot.id } });
      return;
    }

    try {
      await updateDraft({ draftId, spotId: spot.id });
      await queryClient.invalidateQueries({ queryKey: trpc.sessions.draft.queryKey(draftId) });
    } catch (error) {
      notify.error(getErrorMessage(error), 'Unable to Save Spot');
    }
  }, [draftId, isUpdatingDraft, navigate, queryClient, trpc, updateDraft]);

  return (
    <div className={classes.root}>
      <GlobeMap spots={spots} onSpotSelect={handleSpotSelect} />
      {isUpdatingDraft && (
        <div className={classes.saveStatus} role="status">Saving spot…</div>
      )}
      {isPinMode && <AddSpotPanel />}
    </div>
  );
}
