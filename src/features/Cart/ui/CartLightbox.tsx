import { FC, memo, useCallback } from 'react';
import { Badge, Button, Group, Text } from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';
import { formatPrice } from 'shared/lib/currency';
import { formatShortDate } from 'shared/lib/dateUtils';
import { BaseLightbox } from 'shared/ui/BaseLightbox';
import type { CartItem } from 'entities/Commerce';

export interface CartLightboxProps {
  item: CartItem | null;
  onClose: () => void;
  onRemove: (id: string) => void;
}

/**
 * CartLightbox — single-item watermarked preview before checkout.
 * No carousel: the cart grid already shows all items; this is a verify-before-buying modal.
 */
const CartLightbox: FC<CartLightboxProps> = memo(({ item, onClose, onRemove }) => {
  const handleRemove = useCallback(() => {
    if (!item) return;
    onRemove(item.id);
    onClose();
  }, [item, onRemove, onClose]);

  const lightboxItem = item ? { id: item.id, url: item.lightboxUrl } : null;

  return (
    <BaseLightbox
      item={lightboxItem}
      onClose={onClose}
      renderFooter={item ? () => (
        <Group justify="space-between" align="center">
          <Group gap="xs">
            <Text size="sm" fw={500}>{item.spotName}</Text>
            <Text size="xs" c="dimmed">{formatShortDate(item.capturedAt)}</Text>
            <Badge color="blue" variant="filled">{formatPrice(item.priceCents)}</Badge>
          </Group>
          <Button
            variant="subtle"
            color="red"
            leftSection={<IconTrash size={16} />}
            onClick={handleRemove}
          >
            Remove
          </Button>
        </Group>
      ) : undefined}
    />
  );
});

CartLightbox.displayName = 'CartLightbox';
export default CartLightbox;
