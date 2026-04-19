import { createFileRoute } from '@tanstack/react-router';
import { Center, SimpleGrid, Skeleton, Text } from '@mantine/core';
import { PublicGallery } from 'features/PublicGallery';
import { useSpotDetails } from 'entities/Spot/model/useSpotDetails';
import { useCartStore, toCartItem } from 'features/Cart';
import { MediaItem } from 'entities/Media/types';
import { useCallback, useMemo } from 'react';

export const Route = createFileRoute('/_drawer/$spotId/')({
  component: GalleryTab,
});

function GalleryTab() {
  const { spotId } = Route.useParams();
  const { data: details, isLoading } = useSpotDetails(spotId);

  const cartAdd = useCartStore((s) => s.add);
  const cartRemove = useCartStore((s) => s.remove);
  const cartItems = useCartStore((s) => s.items);
  const cartItemIds = useMemo(() => new Set(cartItems.map((i) => i.id)), [cartItems]);

  const handleCartToggle = useCallback((item: MediaItem) => {
    if (cartItemIds.has(item.id)) {
      cartRemove(item.id);
    } else if (details) {
      cartAdd(toCartItem(item, details.name));
    }
  }, [cartItemIds, cartAdd, cartRemove, details]);

  const handleCartBulkAdd = useCallback((items: MediaItem[]) => {
    if (!details) return;
    items.forEach((item) => cartAdd(toCartItem(item, details.name)));
  }, [cartAdd, details]);

  if (isLoading) {
    return (
      <SimpleGrid cols={3} spacing={10} mt="md">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} height={120} radius="sm" />
        ))}
      </SimpleGrid>
    );
  }

  if (!details) {
    return (
      <Center mih={200}>
        <Text c="dimmed" size="sm">Spot not found.</Text>
      </Center>
    );
  }

  return (
    <PublicGallery
      items={details.media}
      spotName={details.name}
      cartItemIds={cartItemIds}
      onCartToggle={handleCartToggle}
      onCartBulkAdd={handleCartBulkAdd}
    />
  );
}
