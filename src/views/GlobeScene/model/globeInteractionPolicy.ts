import type { GlobeInteractionPolicy } from 'widgets/GlobeMap';
import type { GlobeSceneMode } from './globeSceneMode';

export interface GlobeInteractionPolicyInput {
  sceneMode: GlobeSceneMode;
  isRenderedPanelExpanded: boolean;
}

export function deriveGlobeInteractionPolicy({
  sceneMode,
  isRenderedPanelExpanded,
}: GlobeInteractionPolicyInput): GlobeInteractionPolicy {
  if (!isRenderedPanelExpanded) return 'interactive';

  switch (sceneMode.kind) {
    case 'pinPlacement':
    case 'uploadSpotSelection':
      return 'interactive';
    case 'overview':
    case 'spotFocused':
    case 'userExploring':
      return 'background';
  }
}
