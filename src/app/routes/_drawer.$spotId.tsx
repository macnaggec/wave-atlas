import { createFileRoute, Outlet, useNavigate } from '@tanstack/react-router';
import { Indicator, Skeleton, Tabs, Text } from '@mantine/core';
import { useCallback, useState } from 'react';
import { useSpotPreview } from 'entities/Spot/model/useSpotPreview';
import { useCartStore } from 'features/Cart/model/cartStore';
import { CartButton } from 'features/Cart/ui/CartButton';
import { DrawerBody, DrawerHeader } from 'shared/ui/DrawerLayout';
import { useTabNavigation } from 'shared/hooks';
import { SpotUploadContext } from 'app/contexts/SpotUploadContext';

export const Route = createFileRoute('/_drawer/$spotId')({
  component: SpotLayout,
});

const TAB_ROUTES = {
  gallery: '/$spotId',
  upload: '/$spotId/upload',
} as const;

function SpotLayout() {
  const { spotId } = Route.useParams();
  const navigate = useNavigate();
  const { data: preview } = useSpotPreview(spotId);
  const cartCount = useCartStore((s) => s.items.length);
  const [hasNewGallery, setHasNewGallery] = useState(false);

  const {
    activeTab,
    handleTabChange: baseHandleTabChange,
  } = useTabNavigation(TAB_ROUTES, { spotId });

  const handleTabChange = useCallback((tab: string | null) => {
    if (tab === 'gallery') setHasNewGallery(false);
    baseHandleTabChange(tab);
  }, [baseHandleTabChange]);

  const handlePublishSuccess = useCallback(() => {
    setHasNewGallery(true);
  }, []);

  const isUpload = activeTab === 'upload';

  const handleCartClick = useCallback(() => {
    void navigate({ to: '/cart', search: { from: spotId } });
  }, [navigate, spotId]);

  return (
    <SpotUploadContext.Provider value={{ onPublishSuccess: handlePublishSuccess }}>
      <DrawerHeader>
        {preview ? (
          <Text fw={600} size="lg">{preview.name}</Text>
        ) : (
          <Skeleton height={22} width={160} radius="sm" />
        )}
      </DrawerHeader>

      <Tabs value={activeTab} onChange={handleTabChange}>
        <Tabs.List px="md">
          <Tabs.Tab value="gallery">
            <Indicator
              disabled={!hasNewGallery}
              color="red"
              size={8}
              offset={-4}
              processing
            >
              Gallery
            </Indicator>
          </Tabs.Tab>
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
    </SpotUploadContext.Provider>
  );
}
