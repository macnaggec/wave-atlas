import React, { FC, memo, useCallback, useState } from 'react';
import {
  Modal,
  Group,
  Text,
  Badge,
  Button,
  Stack,
} from '@mantine/core';
import { Carousel } from '@mantine/carousel';
import { IconShoppingCartPlus, IconShoppingCartCheck, IconShoppingCartMinus } from '@tabler/icons-react';
import { MediaItem } from 'entities/Media/types';
import { formatPrice } from 'shared/lib/currency';
import { useCartItem } from 'features/Cart/model/useCartItem';
import carouselClasses from 'shared/ui/carousel.module.css';
import classes from './MediaLightbox.module.css';

export interface MediaLightboxProps {
  /** All items navigable within this lightbox session */
  items: MediaItem[];

  /** Index of the item to show on open */
  initialIndex: number;

  /** Whether the modal is open */
  opened: boolean;

  /** Close callback */
  onClose: () => void;

  /** Spot name used for cart item label */
  spotName: string;
}

function getLightboxUrl(item: MediaItem): string {
  return item.lightboxUrl;
}

interface CartButtonProps {
  item: MediaItem;
  spotName: string;
}

/** Isolated component so useCartItem hook re-mounts cleanly when current item changes. */
function LightboxCartButton({ item, spotName }: CartButtonProps) {
  const { isInCart, addToCart, removeFromCart } = useCartItem(item, spotName);
  return (
    <Button
      variant={isInCart ? 'light' : 'subtle'}
      color={isInCart ? 'red' : 'green'}
      leftSection={isInCart ? <IconShoppingCartMinus size={16} /> : <IconShoppingCartPlus size={16} />}
      onClick={isInCart ? removeFromCart : addToCart}
    >
      {isInCart ? 'Remove from cart' : 'Add to cart'}
    </Button>
  );
}

/**
 * MediaLightbox - Full-size watermarked preview modal for PublicGallery
 *
 * Uses Mantine Carousel (Embla) for slide navigation with built-in
 * keyboard (arrow keys), touch/swipe, and prev/next controls.
 */
const MediaLightbox: FC<MediaLightboxProps> = memo(({
  items,
  initialIndex,
  opened,
  onClose,
  spotName,
}) => {
  // Track which slide is active to show its price/date in the footer
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  const handleSlideChange = useCallback((index: number) => {
    setCurrentIndex(index);
  }, []);

  if (items.length === 0) return null;

  const currentItem = items[currentIndex];
  const hasMultiple = items.length > 1;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="xl"
      centered
      padding="md"
      withCloseButton
      zIndex={300}
      title={undefined}
    >
      <Stack gap="md">
        <Carousel
          key={initialIndex}
          height="100%"
          initialSlide={initialIndex}
          withControls={hasMultiple}
          withIndicators={hasMultiple && items.length <= 10}
          onSlideChange={handleSlideChange}
          classNames={{ root: classes.root, controls: classes.controls, indicators: carouselClasses.indicators, indicator: carouselClasses.indicator }}
          emblaOptions={{ align: 'center', loop: true }}
        >
          {items.map((item) => (
            <Carousel.Slide key={item.id}>
              <img
                src={getLightboxUrl(item)}
                alt={`Media preview ${item.id}`}
                className={classes.image}
              />
            </Carousel.Slide>
          ))}
        </Carousel>

        <Group justify="space-between" align="center">
          <Group gap="xs">
            <Badge
              size="lg"
              variant={currentItem.price > 0 ? 'filled' : 'light'}
              color={currentItem.price > 0 ? 'blue' : 'gray'}
            >
              {formatPrice(currentItem.price)}
            </Badge>
            <Text size="sm" c="dimmed">
              {new Date(currentItem.capturedAt).toLocaleDateString()}
            </Text>
          </Group>

          {currentItem.price > 0 && (
            <LightboxCartButton item={currentItem} spotName={spotName} />
          )}
        </Group>
      </Stack>
    </Modal>
  );
});

MediaLightbox.displayName = 'MediaLightbox';

export default MediaLightbox;
