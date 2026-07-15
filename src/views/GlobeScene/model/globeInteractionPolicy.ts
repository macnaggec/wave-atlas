import type { GlobeInteractionPolicy } from 'widgets/GlobeMap';
import type { GlobeSceneMode } from './globeSceneMode';

export interface GlobeInteractionPolicyInput {
  sceneMode: GlobeSceneMode;
  isRenderedPanelExpanded: boolean;
  canCompactPanelFromMap?: boolean;
}

export function deriveGlobeInteractionPolicy({
  sceneMode,
  isRenderedPanelExpanded,
  canCompactPanelFromMap = false,
}: GlobeInteractionPolicyInput): GlobeInteractionPolicy {
  if (!isRenderedPanelExpanded) return 'interactive';
  if (canCompactPanelFromMap) return 'interactive';

  switch (sceneMode.kind) {
    case 'addSpotFlow':
    case 'uploadSpotSelection':
      return 'interactive';
    case 'overview':
    case 'spotFocused':
    case 'userExploring':
      return 'background';
  }
}
