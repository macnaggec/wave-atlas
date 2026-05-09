import { createFileRoute, Outlet } from '@tanstack/react-router';
import { Tabs, Text } from '@mantine/core';
import { DrawerBody, DrawerHeader } from 'shared/ui/DrawerLayout';
import { useTabNavigation } from 'shared/hooks';

const TAB_ROUTES = {
  uploads: '/me',
  purchases: '/me/purchases',
  favorites: '/me/favorites',
} as const;

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
  const { activeTab, handleTabChange } = useTabNavigation(TAB_ROUTES);

  return (
    <>
      <DrawerHeader>
        <Text fw={600} size="lg">My Collection</Text>
      </DrawerHeader>

      <Tabs value={activeTab} onChange={handleTabChange}>
        <Tabs.List px="md">
          <Tabs.Tab value="uploads">My Uploads</Tabs.Tab>
          <Tabs.Tab value="purchases">My Purchases</Tabs.Tab>
          <Tabs.Tab value="favorites">Favorites</Tabs.Tab>
        </Tabs.List>
      </Tabs>

      <DrawerBody>
        <Outlet />
      </DrawerBody>
    </>
  );
}
