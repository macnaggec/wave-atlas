import { useState, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTRPC } from 'app/lib/trpc';
import { useCartStore } from 'features/Cart/model/cartStore';
import { useUser } from 'shared/hooks/useUser';
import { notify } from 'shared/lib/notifications';

export interface CartCheckout {
  guestEmail: string;
  setGuestEmail: (value: string) => void;
  handleCheckout: () => void;
  isPending: boolean;
  totalCents: number;
}

/**
 * Encapsulates checkout mutation, guest email state, and submission logic.
 * Used by the cart drawer route.
 */
export function useCartCheckout(): CartCheckout {
  const trpc = useTRPC();
  const items = useCartStore((s) => s.items);
  const clear = useCartStore((s) => s.clear);
  const totalCents = useCartStore((s) => s.totalCents);
  const { isAuthenticated } = useUser();
  const [guestEmail, setGuestEmail] = useState('');

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
    checkout.mutate({
      itemIds: items.map((i) => i.id),
      guestEmail: !isAuthenticated && guestEmail.trim() ? guestEmail.trim() : undefined,
    });
  }, [checkout.mutate, items, isAuthenticated, guestEmail]);

  return {
    guestEmail,
    setGuestEmail,
    handleCheckout,
    isPending: checkout.isPending,
    totalCents: totalCents(),
  };
}
