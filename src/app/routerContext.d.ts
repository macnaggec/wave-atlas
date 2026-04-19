import type { QueryClient } from '@tanstack/react-query';

declare module '@tanstack/react-router' {
  interface RouterContext {
    queryClient: QueryClient;
  }

  interface StaticDataRouteOption {
    /** Mark a route as rendered inside the global drawer. */
    drawer?: true;
  }
}
