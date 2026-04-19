import { createRootRouteWithContext, Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import type { QueryClient } from '@tanstack/react-query';
import { Button, Center, Drawer, Stack, Text, Title } from '@mantine/core';
import { getErrorMessage } from 'shared/lib/getErrorMessage';
import { useCallback, useEffect, useRef, useState } from 'react';
import classes from './__root.module.css';
import { GlobeScene } from 'views/GlobeScene';
import { AuthModalProvider } from 'features/Auth/AuthModalProvider';
import { AddSpotProvider } from 'features/AddSpot';
import { useCartSessionSync } from 'features/Cart/model/useCartSessionSync';

const TRANSITION_MS = 300;

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootLayout,
  errorComponent: RootError,
  notFoundComponent: RootNotFound,
});

/**
 * RootLayout — always-mounted root.
 *
 * Owns the Drawer.Root so it never unmounts — animation state is never
 * lost on window focus, HMR, or StrictMode double-mount.
 *
 * `opened` is derived from whether a /_drawer route is matched.
 * `appReady` suppresses the open animation on the very first render
 * (direct page load) by setting duration to 0.
 */
function RootLayout() {
  const navigate = useNavigate();
  useCartSessionSync();

  const isDrawerRoute = useRouterState({
    select: (s) => s.matches.some((m) => m.routeId === '/_drawer'),
  });

  const [appReady, setAppReady] = useState(false);
  const [closing, setClosing] = useState(false);
  const isDrawerRouteRef = useRef(isDrawerRoute);
  isDrawerRouteRef.current = isDrawerRoute;

  useEffect(() => {
    setAppReady(true);
  }, []);

  const handleClose = useCallback(() => {
    setClosing(true);
  }, []);

  const handleExited = useCallback(() => {
    setClosing(false);
    if (isDrawerRouteRef.current) {
      void navigate({ to: '/' });
    }
  }, [navigate]);

  const drawerOpened = isDrawerRoute && !closing;

  return (
    <AuthModalProvider>
      <AddSpotProvider>
        <GlobeScene />
        <Drawer.Root
          opened={drawerOpened}
          onClose={handleClose}
          position="right"
          size="xl"
          zIndex={200}
          transitionProps={{
            duration: appReady ? TRANSITION_MS : 0,
            onExited: handleExited,
          }}
        >
          <Drawer.Overlay backgroundOpacity={0.4} blur={4} />
          <Drawer.Content>
            {isDrawerRoute && <Outlet />}
          </Drawer.Content>
        </Drawer.Root>
        {!isDrawerRoute && <Outlet />}
      </AddSpotProvider>
    </AuthModalProvider>
  );
}

function RootError({ error }: { error: Error }) {
  const navigate = useNavigate();
  return (
    <Center className={classes.overlay}>
      <Stack align="center" gap="sm" maw={400} ta="center" p="xl">
        <Title order={3} c="white">Something went wrong</Title>
        <Text c="dimmed" size="sm">{getErrorMessage(error)}</Text>
        <Button onClick={() => navigate({ to: '/' })}>Go home</Button>
      </Stack>
    </Center>
  );
}

function RootNotFound() {
  const navigate = useNavigate();
  return (
    <Center className={classes.overlay}>
      <Stack align="center" gap="sm" maw={400} ta="center" p="xl">
        <Title order={3} c="white">Page not found</Title>
        <Text c="dimmed" size="sm">The page you're looking for doesn't exist.</Text>
        <Button onClick={() => navigate({ to: '/' })}>Go home</Button>
      </Stack>
    </Center>
  );
}


