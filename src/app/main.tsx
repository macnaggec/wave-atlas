import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider, createRouter } from '@tanstack/react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import '@mantine/core/styles.css';
import '@mantine/carousel/styles.css';
import '@mantine/dates/styles.css';
import '@mantine/notifications/styles.css';
import './app.css';
import { routeTree } from './routeTree.gen';
import { TRPCProvider } from 'app/lib/trpc';
import { queryClient } from 'app/lib/queryClient';
import { trpcClient } from 'app/lib/trpcClient';

const router = createRouter({ routeTree, context: { queryClient } });

declare module '@tanstack/react-router' {
  interface Register { router: typeof router; }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <TRPCProvider
        trpcClient={trpcClient}
        queryClient={queryClient}
      >
        <MantineProvider>
          <Notifications
            position="top-right"
            zIndex={1000}
            limit={5}
            autoClose={5000}
          />

          <RouterProvider router={router} />
        </MantineProvider>
      </TRPCProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
