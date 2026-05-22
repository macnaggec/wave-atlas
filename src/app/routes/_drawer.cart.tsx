import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Text } from '@mantine/core';
import { useCallback, useState } from 'react';
import { useCartStore } from 'features/Cart/model/cartStore';
import { useCartCheckout } from 'features/Cart/model/useCartCheckout';
import { useSpotPreview } from 'entities/Spot/model/useSpotPreview';
import { BaseGallery } from 'shared/ui/BaseGallery';

import CartCard from 'features/Cart/ui/CartCard';
import CartLightbox from 'features/Cart/ui/CartLightbox';
import { CartDrawerHeader } from 'features/Cart/ui/CartDrawerHeader';
import { CheckoutButton } from 'features/Cart/ui/CheckoutButton';
import type { CartItem } from 'features/Cart/model/types';
import { DrawerBody } from 'shared/ui/DrawerLayout';

export const Route = createFileRoute('/_drawer/cart')({
  validateSearch: (search): { from?: string } => ({
    from: typeof search.from === 'string' ? search.from : undefined,
  }),
  component: CartDrawerRoute,
});

function CartDrawerRoute() {
  const { from } = Route.useSearch();
  const navigate = useNavigate();
  const items = useCartStore((s) => s.items);
  const remove = useCartStore((s) => s.remove);
  const { data: spotPreview } = useSpotPreview(from ?? '');
  const { handleCheckout, isPending, totalCents } = useCartCheckout();

  const [lightboxItem, setLightboxItem] = useState<CartItem | null>(null);

  const handleBack = useCallback(() => {
    if (from) void navigate({ to: '/$spotId', params: { spotId: from } });
  }, [navigate, from]);

  const renderCartCard = useCallback(
    (item: CartItem) => (
      <CartCard
        item={item}
        onRemove={remove}
        onClick={() => setLightboxItem(item)}
      />
    ),
    [remove],
  );

  return (
    <>
      <CartDrawerHeader
        itemCount={items.length}
        spotName={from && spotPreview ? spotPreview.name : undefined}
        onBack={from ? handleBack : undefined}
      />

      <DrawerBody>
        <BaseGallery<CartItem>
          items={items}
          renderCard={renderCartCard}
          emptyState={
            <Text c="dimmed" size="sm" ta="center" mt="xl">
              Your cart is empty
            </Text>
          }
        />
      </DrawerBody>

      {items.length > 0 && (
        <CheckoutButton
          totalCents={totalCents}
          isPending={isPending}
          onCheckout={handleCheckout}
        />
      )}

      <CartLightbox
        item={lightboxItem}
        onClose={() => setLightboxItem(null)}
        onRemove={remove}
      />
    </>
  );
}
