import { FC, memo, useCallback } from 'react';
import { ActionIcon, Text, Stack } from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';
import { CartItem } from 'features/Cart/model/types';
import { formatPrice } from 'shared/lib/currency';
import { BaseCard } from 'shared/ui/BaseGallery';
import classes from './CartCard.module.css';

export interface CartCardProps {
  item: CartItem;
  onRemove: (id: string) => void;
}

/**
 * CartCard — gallery card for items in the cart.
 *
 * Mirrors PublicCard visually: same BaseCard shell, same action slot.
 * Single action: remove from cart (trash icon).
 */
const CartCard: FC<CartCardProps> = memo(({ item, onRemove }) => {
  const handleRemove = useCallback(
    () => onRemove(item.id),
    [onRemove, item.id],
  );

  const [spotName, date] = item.label.split(' · ');

  return (
    <BaseCard
      imageUrl={item.thumbnailUrl}
      resourceType="image"
      alt={item.label}
      overlays={
        <Stack gap={2}>
          <Text size="xs" fw={700} c="white" className={classes.priceLabel}>
            {spotName}
          </Text>
          <Text size="xs" c="white" className={classes.priceLabel}>
            {date}
          </Text>
          <Text size="xs" fw={600} c="white" className={classes.priceLabel}>
            {formatPrice(item.priceCents)}
          </Text>
        </Stack>
      }
      actions={
        <ActionIcon
          variant="filled"
          color="red"
          size="md"
          aria-label={`Remove ${item.label} from cart`}
          onClick={handleRemove}
        >
          <IconTrash size={14} />
        </ActionIcon>
      }
    />
  );
});

CartCard.displayName = 'CartCard';

export default CartCard;
