import { FC, memo } from 'react';
import { Group, Text, Badge, Button } from '@mantine/core';
import { IconShoppingCartPlus, IconShoppingCartMinus } from '@tabler/icons-react';
import { MediaItem } from 'entities/Media/types';
import { formatPrice } from 'shared/lib/currency';
import { CarouselLightbox } from 'shared/ui/CarouselLightbox';

export interface MediaLightboxProps {
  /** All items navigable within this lightbox session */
  items: MediaItem[];
  /** Index of the item to show on open */
  initialIndex: number;
  /** Whether the modal is open */
  opened: boolean;
  /** Close callback */
  onClose: () => void;
  /** IDs currently in the cart — drives cart button active state */
  cartItemIds?: Set<string>;
  /** Called when the cart button is clicked for an item */
  onCartToggle?: (item: MediaItem) => void;
  /** IDs of media items owned by the current user — cart button hidden for these */
  ownedItemIds?: Set<string>;
}

/**
 * MediaLightbox - Full-size watermarked preview modal for PublicGallery.
 * Footer: price + date on the left, add/remove cart button on the right.
 */
const MediaLightbox: FC<MediaLightboxProps> = memo(({
  items,
  initialIndex,
  opened,
  onClose,
  cartItemIds = new Set<string>(),
  onCartToggle,
  ownedItemIds = new Set<string>(),
}) => {
  const lightboxItems = items.map((item) => ({
    id: item.id,
    url: item.lightboxUrl,
    type: item.resource.resource_type as 'image' | 'video',
  }));

  return (
    <CarouselLightbox
      items={lightboxItems}
      initialIndex={initialIndex}
      opened={opened}
      onClose={onClose}
      renderFooter={(currentIndex) => {
        const item = items[currentIndex];
        if (!item) return null;
        const isOwn = ownedItemIds.has(item.id);
        const isInCart = cartItemIds.has(item.id);
        return (
          <Group justify="space-between" align="center">
            <Group gap="xs">
              <Badge
                size="lg"
                variant={item.price > 0 ? 'filled' : 'light'}
                color={item.price > 0 ? 'blue' : 'gray'}
              >
                {formatPrice(item.price)}
              </Badge>
              <Text size="sm" c="dimmed">
                {new Date(item.capturedAt).toLocaleDateString()}
              </Text>
            </Group>

            {item.price > 0 && !isOwn && onCartToggle && (
              <Button
                variant={isInCart ? 'light' : 'subtle'}
                color={isInCart ? 'red' : 'green'}
                leftSection={isInCart ? <IconShoppingCartMinus size={16} /> : <IconShoppingCartPlus size={16} />}
                onClick={() => onCartToggle(item)}
              >
                {isInCart ? 'Remove from cart' : 'Add to cart'}
              </Button>
            )}
          </Group>
        );
      }}
    />
  );
});

MediaLightbox.displayName = 'MediaLightbox';

export default MediaLightbox;
