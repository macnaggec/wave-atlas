import { Button } from '@mantine/core';
import { IconShoppingCart } from '@tabler/icons-react';
import { formatPrice } from 'shared/lib/currency';
import materials from 'shared/ui/design-system/materials.module.css';
import styles from './CheckoutButton.module.css';

export interface CheckoutButtonProps {
  totalCents: number;
  isPending: boolean;
  onCheckout: () => void;
}

export function CheckoutButton({ totalCents, isPending, onCheckout }: CheckoutButtonProps) {
  return (
    <Button
      className={`${materials.primaryAction} ${styles.button}`}
      data-panel-gallery-primary-action="glass-green"
      data-panel-gallery-primary-action-size="compact"
      size="lg"
      radius="md"
      leftSection={<IconShoppingCart size={20} />}
      loading={isPending}
      onClick={onCheckout}
    >
      Checkout · {formatPrice(totalCents)}
    </Button>
  );
}
