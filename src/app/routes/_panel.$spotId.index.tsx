import { createFileRoute } from '@tanstack/react-router';
import { Center, Text } from '@mantine/core';
import { PublicGallery } from 'features/PublicGallery';
import { useSpotPreview } from 'entities/Spot/model/useSpotPreview';
import { useCartStore, toCartItem } from 'features/Cart';
import { MediaItem } from 'entities/Media/types';
import { useCallback, useMemo } from 'react';

export const Route = createFileRoute('/_panel/$spotId/')({
  component: GalleryTab,
});

function GalleryTab() {
  const { spotId } = Route.useParams();
  const { data: details } = useSpotPreview(spotId);

  const cartAdd = useCartStore((s) => s.add);
  const cartRemove = useCartStore((s) => s.remove);
  const cartItems = useCartStore((s) => s.items);
  const cartItemIds = useMemo(() => new Set(cartItems.map((i) => i.id)), [cartItems]);

  const handleCartToggle = useCallback(
    (item: MediaItem) => {
      if (cartItemIds.has(item.id)) {
        cartRemove(item.id);
      } else if (details) {
        cartAdd(toCartItem(item, details.name));
      }
    },
    [cartItemIds, cartAdd, cartRemove, details],
  );

  const handleCartBulkAdd = useCallback(
    (items: MediaItem[]) => {
      if (!details) return;
      items.forEach((item) => cartAdd(toCartItem(item, details.name)));
    },
    [cartAdd, details],
  );

  if (!details) {
    return (
      <Center mih={200}>
        <Text c="dimmed" size="sm">Spot not found.</Text>
      </Center>
    );
  }

  return (
    <PublicGallery
      spotId={spotId}
      cartItemIds={cartItemIds}
      onCartToggle={handleCartToggle}
      onCartBulkAdd={handleCartBulkAdd}
    />
  );
}
