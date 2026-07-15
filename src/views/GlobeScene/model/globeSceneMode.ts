export type GlobeSceneMode =
  | { kind: 'overview' }
  | { kind: 'spotFocused'; spotId: string }
  | { kind: 'addSpotFlow' }
  | { kind: 'uploadSpotSelection' }
  | { kind: 'userExploring' };

export interface GlobeSceneModeInput {
  isAddSpotActive: boolean;
  isUploadSpotSelectionActive: boolean;
  selectedSpotId: string | null;
  isUserExploring: boolean;
}

export function deriveGlobeSceneMode({
  isAddSpotActive,
  isUploadSpotSelectionActive,
  selectedSpotId,
  isUserExploring,
}: GlobeSceneModeInput): GlobeSceneMode {
  if (isAddSpotActive) return { kind: 'addSpotFlow' };
  if (isUploadSpotSelectionActive) return { kind: 'uploadSpotSelection' };
  if (selectedSpotId) return { kind: 'spotFocused', spotId: selectedSpotId };
  if (isUserExploring) return { kind: 'userExploring' };
  return { kind: 'overview' };
}
