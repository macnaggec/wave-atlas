import { useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTRPC } from 'app/lib/trpc';
import { useCartStore } from 'features/Cart/model/cartStore';
import { notify } from 'shared/lib/notifications';

export interface CartCheckout {
  handleCheckout: () => void;
  isPending: boolean;
  totalCents: number;
}

/**
 * Encapsulates checkout mutation and submission logic.
 * Checkout is authenticated-only — guest flow was removed.
 */
export function useCartCheckout(): CartCheckout {
  const trpc = useTRPC();
  const items = useCartStore((s) => s.items);
  const clear = useCartStore((s) => s.clear);
  const totalCents = useCartStore((s) => s.totalCents);

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

  const handleCheckout = useCallback(() => {
    checkout.mutate({ itemIds: items.map((i) => i.id) });
  }, [checkout.mutate, items]);

  return {
    handleCheckout,
    isPending: checkout.isPending,
    totalCents: totalCents(),
  };
}
