export type GlobeSceneMode =
  | { kind: 'overview' }
  | { kind: 'spotFocused'; spotId: string }
  | { kind: 'pinPlacement' }
  | { kind: 'uploadSpotSelection' }
  | { kind: 'userExploring' };

export interface GlobeSceneModeInput {
  isPinPlacementActive: boolean;
  isUploadSpotSelectionActive: boolean;
  selectedSpotId: string | null;
  isUserExploring: boolean;
}

export function deriveGlobeSceneMode({
  isPinPlacementActive,
  isUploadSpotSelectionActive,
  selectedSpotId,
  isUserExploring,
}: GlobeSceneModeInput): GlobeSceneMode {
  if (isPinPlacementActive) return { kind: 'pinPlacement' };
  if (isUploadSpotSelectionActive) return { kind: 'uploadSpotSelection' };
  if (selectedSpotId) return { kind: 'spotFocused', spotId: selectedSpotId };
  if (isUserExploring) return { kind: 'userExploring' };
  return { kind: 'overview' };
}
