export type AppChromePolicyReason = 'default' | 'addSpotFlow' | 'fullPageRoute';

export interface AppChromePolicyInput {
  isAddSpotActive: boolean;
  isFullPageRouteActive?: boolean;
}

export interface AppChromePolicy {
  showLeftStrip: boolean;
  showSidePanel: boolean;
  showFloatingPanelControls: boolean;
  showMapNavigationControl: boolean;
  reason: AppChromePolicyReason;
}

export function deriveAppChromePolicy({
  isAddSpotActive,
  isFullPageRouteActive = false,
}: AppChromePolicyInput): AppChromePolicy {
  if (isAddSpotActive) {
    return {
      showLeftStrip: false,
      showSidePanel: false,
      showFloatingPanelControls: false,
      showMapNavigationControl: false,
      reason: 'addSpotFlow',
    };
  }

  if (isFullPageRouteActive) {
    return {
      showLeftStrip: false,
      showSidePanel: true,
      showFloatingPanelControls: true,
      showMapNavigationControl: true,
      reason: 'fullPageRoute',
    };
  }

  return {
    showLeftStrip: true,
    showSidePanel: true,
    showFloatingPanelControls: true,
    showMapNavigationControl: true,
    reason: 'default',
  };
}
