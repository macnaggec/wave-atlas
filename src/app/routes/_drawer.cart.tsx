import { createFileRoute } from '@tanstack/react-router';
import { Text } from '@mantine/core';
import { useMutation } from '@tanstack/react-query';
import { useTRPC } from 'app/lib/trpc';
import { useCartStore } from 'features/Cart/model/cartStore';
import { notify } from 'shared/lib/notifications';
import { BaseGallery } from 'shared/ui/BaseGallery';
import CartCard from 'features/Cart/ui/CartCard';
import { CheckoutButton } from 'features/Cart/ui/CheckoutButton';
import type { CartItem } from 'features/Cart/model/types';
import { DrawerBody, DrawerHeader } from 'shared/ui/DrawerLayout';

/**
 * CartDrawerRoute — drawer content for the cart route (/cart).
 *
 * Driven by navigation — opening/closing is handled by the root drawer
 * via route matching, the same as spot and profile drawers.
 */
function CartDrawerRoute() {
  const items = useCartStore((s) => s.items);
  const remove = useCartStore((s) => s.remove);
  const clear = useCartStore((s) => s.clear);
  const totalCents = useCartStore((s) => s.totalCents);
  const trpc = useTRPC();

  const checkout = useMutation({
    ...trpc.checkout.create.mutationOptions(),
    onSuccess: ({ checkoutUrl }) => {
      clear();
      window.location.href = checkoutUrl;
    },
    onError: (error) => {
      notify.error(
        error instanceof Error ? error.message : 'Checkout failed. Please try again'
      );
    },
  });

  return (
    <>
      <DrawerHeader>
        <Text fw={600} size="lg">
          Cart{items.length > 0 ? ` (${items.length})` : ''}
        </Text>
      </DrawerHeader>

      <DrawerBody>
        <BaseGallery<CartItem>
          items={items}
          renderCard={(item) => (
            <CartCard item={item} onRemove={remove} />
          )}
          emptyState={
            <Text c="dimmed" size="sm" ta="center" mt="xl">
              Your cart is empty
            </Text>
          }
        />
      </DrawerBody>

      {items.length > 0 && (
        <CheckoutButton
          totalCents={totalCents()}
          isPending={checkout.isPending}
          onCheckout={() => checkout.mutate(
            { itemIds: items.map((i) => i.id) }
          )}
        />
      )}
    </>
  );
}

export const Route = createFileRoute('/_drawer/cart')({
  component: CartDrawerRoute,
});
