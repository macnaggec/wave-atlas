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
import { IconShoppingCartPlus, IconShoppingCartMinus } from '@tabler/icons-react';
import { MediaItem } from 'entities/Media/types';
import { formatPrice } from 'shared/lib/currency';
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

  /** IDs currently in the cart — drives cart button active state */
  cartItemIds?: Set<string>;

  /** Called when the cart button is clicked for an item */
  onCartToggle?: (item: MediaItem) => void;

  /** IDs of media items owned by the current user — cart button hidden for these */
  ownedItemIds?: Set<string>;
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
  cartItemIds = new Set<string>(),
  onCartToggle,
  ownedItemIds = new Set<string>(),
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  const handleSlideChange = useCallback((index: number) => {
    setCurrentIndex(index);
  }, []);

  if (items.length === 0) return null;

  const currentItem = items[currentIndex];
  const hasMultiple = items.length > 1;
  const isOwn = ownedItemIds.has(currentItem.id);
  const isInCart = cartItemIds.has(currentItem.id);

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
                src={item.lightboxUrl}
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

          {currentItem.price > 0 && !isOwn && onCartToggle && (
            <Button
              variant={isInCart ? 'light' : 'subtle'}
              color={isInCart ? 'red' : 'green'}
              leftSection={isInCart ? <IconShoppingCartMinus size={16} /> : <IconShoppingCartPlus size={16} />}
              onClick={() => onCartToggle(currentItem)}
            >
              {isInCart ? 'Remove from cart' : 'Add to cart'}
            </Button>
          )}
        </Group>
      </Stack>
    </Modal>
  );
});

MediaLightbox.displayName = 'MediaLightbox';

export default MediaLightbox;
