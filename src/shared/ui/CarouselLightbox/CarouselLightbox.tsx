import { FC, memo, ReactNode, useEffect, useState } from 'react';
import { Modal, Stack } from '@mantine/core';
import { Carousel } from '@mantine/carousel';
import classes from './CarouselLightbox.module.css';
import carouselClasses from 'shared/ui/carousel.module.css';

export interface CarouselLightboxItem {
  id: string;
  url: string;
  type?: 'image' | 'video';
}

export interface CarouselLightboxProps {
  items: CarouselLightboxItem[];
  initialIndex: number;
  opened: boolean;
  onClose: () => void;
  /** Receives the current carousel index; render context-specific actions per slide. */
  renderFooter?: (currentIndex: number) => ReactNode;
}

/**
 * CarouselLightbox — navigable multi-item modal with keyboard, swipe, and prev/next controls.
 * Callers supply renderFooter to add context-specific actions per slide.
 */
const CarouselLightbox: FC<CarouselLightboxProps> = memo(({ items, initialIndex, opened, onClose, renderFooter }) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  // Sync currentIndex when the lightbox opens or a different item is targeted.
  useEffect(() => {
    if (opened) setCurrentIndex(initialIndex);
  }, [initialIndex, opened]);

  const hasMultiple = items.length > 1;

  return (
    <Modal opened={opened} onClose={onClose} size="xl" centered padding="md" withCloseButton overlayProps={{ backgroundOpacity: 0.45, blur: 4 }} styles={{ content: { borderRadius: 16, overflow: 'hidden' } }} zIndex={300}>
      <Stack gap="md">
        {/* key forces Embla to snap to the correct slide when initialIndex changes */}
        <Carousel
          key={initialIndex}
          height="100%"
          initialSlide={initialIndex}
          withControls={hasMultiple}
          withIndicators={hasMultiple && items.length <= 10}
          onSlideChange={setCurrentIndex}
          classNames={{
            root: classes.root,
            controls: classes.controls,
            indicators: carouselClasses.indicators,
            indicator: carouselClasses.indicator,
          }}
          emblaOptions={{ align: 'center', loop: true }}
        >
          {items.map((item) => (
            <Carousel.Slide key={item.id}>
              {item.type === 'video'
                ? <video src={item.url} className={classes.media} controls preload="metadata" />
                : <img src={item.url} alt="Media preview" className={classes.media} />
              }
            </Carousel.Slide>
          ))}
        </Carousel>

        {renderFooter?.(currentIndex)}
      </Stack>
    </Modal>
  );
});

CarouselLightbox.displayName = 'CarouselLightbox';
export default CarouselLightbox;
