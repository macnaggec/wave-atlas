import { Button } from '@mantine/core';
import { IconShoppingCart } from '@tabler/icons-react';
import { FloatingAction } from 'shared/ui/DrawerLayout';
import { formatPrice } from 'shared/lib/currency';

export interface CheckoutButtonProps {
  totalCents: number;
  isPending: boolean;
  onCheckout: () => void;
}

export function CheckoutButton({ totalCents, isPending, onCheckout }: CheckoutButtonProps) {
  return (
    <FloatingAction>
      <Button
        size="lg"
        leftSection={<IconShoppingCart size={20} />}
        loading={isPending}
        color="green"
        onClick={onCheckout}
      >
        Checkout · {formatPrice(totalCents)}
      </Button>
    </FloatingAction>
  );
}
