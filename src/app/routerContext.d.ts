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
    /** Panel layout mode owned by the route contract. */
    panelMode?: 'browsing' | 'workspace' | 'mapInput' | 'galleryWorkspace';
  }
}
