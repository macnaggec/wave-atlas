import { useMutation } from '@tanstack/react-query';
import { useTRPC } from 'shared/lib/trpc';
import { useCartStore } from 'entities/Commerce/model/cartStore';
import { notify } from 'shared/lib/notifications';

export interface CartCheckout {
  handleCheckout: () => void;
  isPending: boolean;
  totalCents: number;
}

export function useCartCheckout(): CartCheckout {
  const trpc = useTRPC();
  const items = useCartStore((s) => s.items);
  const totalCents = useCartStore((s) => s.totalCents);

  const checkout = useMutation({
    ...trpc.checkout.create.mutationOptions(),
    onSuccess: ({ checkoutUrl }) => {
      window.location.href = checkoutUrl;
    },
    onError: (error) => {
      notify.error(
        error instanceof Error ? error.message : 'Checkout failed. Please try again'
      );
    },
  });

  const handleCheckout = () => {
    checkout.mutate({ itemIds: items.map((i) => i.id) });
  };

  return {
    handleCheckout,
    isPending: checkout.isPending,
    totalCents: totalCents(),
  };
}
