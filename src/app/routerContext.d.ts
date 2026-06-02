import type { QueryClient } from '@tanstack/react-query';

declare module '@tanstack/react-router' {
  interface RouterContext {
    queryClient: QueryClient;
  }

  interface StaticDataRouteOption {
    /** Mark a route as rendered inside the global drawer. */
    drawer?: true;
    /** Panel header text — read by PanelFrame in _panel.tsx; no effect bridge needed. */
    panelHeader?: string;
    /** When true: panel is force-expanded (75vw) with a back button instead of a toggle. */
    forceExpanded?: boolean;
  }
}
