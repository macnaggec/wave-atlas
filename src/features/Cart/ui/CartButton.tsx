import { useNavigate } from '@tanstack/react-router';
import { Button } from '@mantine/core';
import { IconShoppingCart } from '@tabler/icons-react';
import { useCartStore } from 'entities/Commerce';
import { FloatingAction } from 'shared/ui/DrawerLayout';

export interface CartButtonProps {
  spotId: string;
}

export function CartButton({ spotId }: CartButtonProps) {
  const navigate = useNavigate();
  const count = useCartStore((s) => s.items.length);

  if (count === 0) return null;

  const handleClick = () => {
    void navigate({ to: '/cart', search: { from: spotId } });
  };

  return (
    <FloatingAction>
      <Button
        size="lg"
        leftSection={<IconShoppingCart size={20} />}
        onClick={handleClick}
      >
        View Cart ({count})
      </Button>
    </FloatingAction>
  );
}
