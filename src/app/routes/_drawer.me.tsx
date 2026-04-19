import { createFileRoute, Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import { Drawer, Tabs, Text } from '@mantine/core';
import { useCallback } from 'react';

export const Route = createFileRoute('/_drawer/me')({
  component: MeLayout,
});

/**
 * MeLayout — drawer content structure for the authenticated user's gallery.
 *
 * Always renders inside Drawer.Content (provided by DrawerLayout in _drawer.tsx).
 * Three URL-driven tabs: uploads (/me), purchases (/me/purchases), favorites (/me/favorites).
 */
function MeLayout() {
  const navigate = useNavigate();

  const activeTab = useRouterState({
    select: (s) => {
      const p = s.location.pathname;
      if (p.endsWith('/purchases')) return 'purchases';
      if (p.endsWith('/favorites')) return 'favorites';
      return 'uploads';
    },
  });

  const handleTabChange = useCallback(
    (tab: string | null) => {
      if (!tab) return;
      if (tab === 'purchases') void navigate({ to: '/me/purchases' });
      else if (tab === 'favorites') void navigate({ to: '/me/favorites' });
      else void navigate({ to: '/me' });
    },
    [navigate],
  );

  return (
    <>
      <Drawer.Header>
        <Text fw={600} size="lg">My Collection</Text>
        <Drawer.CloseButton />
      </Drawer.Header>

      <Tabs value={activeTab} onChange={handleTabChange}>
        <Tabs.List px="md">
          <Tabs.Tab value="uploads">My Uploads</Tabs.Tab>
          <Tabs.Tab value="purchases">My Purchases</Tabs.Tab>
          <Tabs.Tab value="favorites">Favorites</Tabs.Tab>
        </Tabs.List>
      </Tabs>

      <Drawer.Body>
        <Outlet />
      </Drawer.Body>
    </>
  );
}
