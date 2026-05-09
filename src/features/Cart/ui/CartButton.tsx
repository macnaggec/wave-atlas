import { Button } from '@mantine/core';
import { IconShoppingCart } from '@tabler/icons-react';
import { FloatingAction } from 'shared/ui/DrawerLayout';

export interface CartButtonProps {
  count: number;
  onClick: () => void;
}

export function CartButton({ count, onClick }: CartButtonProps) {
  if (count === 0) return null;

  return (
    <FloatingAction>
      <Button
        size="lg"
        leftSection={<IconShoppingCart size={20} />}
        onClick={onClick}
      >
        View Cart ({count})
      </Button>
    </FloatingAction>
  );
}
