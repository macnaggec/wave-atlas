import { createFileRoute, Outlet } from '@tanstack/react-router';
import { Tabs } from '@mantine/core';
import { useTabNavigation } from 'shared/hooks';

const TAB_ROUTES = {
  uploads: '/me',
  purchases: '/me/purchases',
  favorites: '/me/favorites',
} as const;

export const Route = createFileRoute('/_panel/me')({
  staticData: { panelHeader: 'My Collection', forceExpanded: true },
  component: MeLayout,
});

function MeLayout() {
  const { activeTab, handleTabChange } = useTabNavigation(TAB_ROUTES);

  return (
    <>
      <Tabs value={activeTab} onChange={handleTabChange}>
        <Tabs.List px="md">
          <Tabs.Tab value="uploads">My Uploads</Tabs.Tab>
          <Tabs.Tab value="purchases">My Purchases</Tabs.Tab>
          <Tabs.Tab value="favorites">Favorites</Tabs.Tab>
        </Tabs.List>
      </Tabs>

      <Outlet />
    </>
  );
}
