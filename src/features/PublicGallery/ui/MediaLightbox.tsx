import { FC, memo } from 'react';
import { Group, Text, Badge, Button } from '@mantine/core';
import { IconShoppingCartPlus, IconShoppingCartMinus } from '@tabler/icons-react';
import { formatPrice } from 'shared/lib/currency';
import { CarouselLightbox } from 'shared/ui/CarouselLightbox';

/** Minimal shape MediaLightbox needs — satisfied by both MediaItem and PublishedMedia. */
export interface LightboxMedia {
  id: string;
  lightboxUrl: string;
  thumbnailUrl: string;
  /** Present on MediaItem */
  resource?: { resource_type: string };
  /** Present on PublishedMedia */
  type?: 'PHOTO' | 'VIDEO';
  price: number | null;
  capturedAt: Date;
  photographerId: string;
}

export interface MediaLightboxProps {
  items: LightboxMedia[];
  initialIndex: number;
  opened: boolean;
  onClose: () => void;
  cartItemIds?: Set<string>;
  onCartToggle?: (item: LightboxMedia) => void;
  ownedItemIds?: Set<string>;
}

/**
 * MediaLightbox - Full-size watermarked preview modal.
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
  const lightboxItems = items.map((item) => {
    const isVideo = item.resource?.resource_type === 'video' || item.type === 'VIDEO';
    return { id: item.id, url: item.lightboxUrl, type: (isVideo ? 'video' : 'image') as 'image' | 'video' };
  });

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
                variant={(item.price ?? 0) > 0 ? 'filled' : 'light'}
                color={(item.price ?? 0) > 0 ? 'blue' : 'gray'}
              >
                {formatPrice(item.price ?? 0)}
              </Badge>
              <Text size="sm" c="dimmed">
                {new Date(item.capturedAt).toLocaleDateString()}
              </Text>
            </Group>

            {(item.price ?? 0) > 0 && !isOwn && onCartToggle && (
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
