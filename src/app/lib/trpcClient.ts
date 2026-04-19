import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { createTRPCOptionsProxy } from '@trpc/tanstack-react-query';
import superjson from 'superjson';
import type { AppRouter } from 'server/router';
import { queryClient } from 'app/lib/queryClient';

export const trpcClient = createTRPCClient<AppRouter>({
  links: [httpBatchLink({ url: '/api/trpc', transformer: superjson })],
});

/** Type-safe proxy for use in route loaders (non-React context). */
export const trpcProxy = createTRPCOptionsProxy<AppRouter>({
  client: trpcClient,
  queryClient,
});
