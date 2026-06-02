import { createRootRouteWithContext, Outlet, useNavigate } from '@tanstack/react-router';
import type { QueryClient } from '@tanstack/react-query';
import { Button, Center, Stack, Text, Title } from '@mantine/core';
import { AppShell } from 'app/AppShell';
import { AuthModalProvider } from 'features/Auth/AuthModalProvider';
import { AddSpotProvider } from 'features/AddSpot';
import { useCartSessionSync } from 'features/Cart/model/useCartSessionSync';
import classes from './__root.module.css';
import { getErrorMessage } from 'shared/lib/getErrorMessage';

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootLayout,
  errorComponent: RootError,
  notFoundComponent: RootNotFound,
});

function RootLayout() {
  useCartSessionSync();

  return (
    <AuthModalProvider>
      <AddSpotProvider>
        <AppShell />
        <Outlet />
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
