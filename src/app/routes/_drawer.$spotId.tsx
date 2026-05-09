import { createFileRoute, Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import { Skeleton, Tabs, Text } from '@mantine/core';
import { useCallback } from 'react';
import { useSpotPreview } from 'entities/Spot/model/useSpotPreview';
import { useCartStore } from 'features/Cart/model/cartStore';
import { CartButton } from 'features/Cart/ui/CartButton';
import { DrawerBody, DrawerHeader } from 'shared/ui/DrawerLayout';
import { useTabNavigation } from 'shared/hooks';

export const Route = createFileRoute('/_drawer/$spotId')({
  component: SpotLayout,
});

const TAB_ROUTES = {
  gallery: '/$spotId',
  upload: '/$spotId/upload',
} as const;

/**
 * SpotLayout — drawer content structure for a spot.
 *
 * Always renders inside Drawer.Content (provided by DrawerOutlet in root).
 * The tab strip is driven by the URL — no custom hook, just router state.
 */
function SpotLayout() {
  const { spotId } = Route.useParams();
  const navigate = useNavigate();
  const { data: preview } = useSpotPreview(spotId);
  const cartCount = useCartStore((s) => s.items.length);

  const {
    activeTab,
    handleTabChange
  } = useTabNavigation(TAB_ROUTES, { spotId });

  const isUpload = activeTab === 'upload';

  const handleCartClick = useCallback(() => {
    void navigate({ to: '/cart' });
  }, [navigate]);

  return (
    <>
      <DrawerHeader>
        {preview ? (
          <Text fw={600} size="lg">{preview.name}</Text>
        ) : (
          <Skeleton height={22} width={160} radius="sm" />
        )}
      </DrawerHeader>

      <Tabs value={activeTab} onChange={handleTabChange}>
        <Tabs.List px="md">
          <Tabs.Tab value="gallery">Gallery</Tabs.Tab>
          <Tabs.Tab value="upload">Upload</Tabs.Tab>
        </Tabs.List>
      </Tabs>

      <DrawerBody>
        <Outlet />
      </DrawerBody>

      {!isUpload && (
        <CartButton
          count={cartCount}
          onClick={handleCartClick}
        />
      )}
    </>
  );
}
