export type PanelRouteMode = 'browsing' | 'workspace' | 'mapInput';

export interface PanelRouteMatch {
  routeId: string;
  staticData?: {
    panelMode?: PanelRouteMode;
  };
}

export function getPanelRouteMode(matches: readonly PanelRouteMatch[]): PanelRouteMode {
  return [...matches].reverse().find((match) => match.staticData?.panelMode)?.staticData?.panelMode ?? 'browsing';
}
