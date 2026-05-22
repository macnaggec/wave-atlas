import { memo, useCallback, useMemo } from 'react';
import { Group } from '@mantine/core';
import { CarouselLightbox } from 'shared/ui/CarouselLightbox';
import { DateEditPopover, PriceEditPopover } from 'features/Upload/ui/popovers';
import { PublishedUploadItem } from 'features/Upload/ui/cards/PublishedCard';

interface OwnerLightboxProps {
  items: PublishedUploadItem[];
  initialIndex: number;
  opened: boolean;
  onClose: () => void;
  onUpdate: (id: string, update: { price?: number; capturedAt?: Date }) => Promise<void>;
}

/**
 * Full-screen carousel lightbox for the owner's uploads tab.
 * Renders date and price edit popovers in the footer for each image.
 */
export const OwnerLightbox = memo(({
  items,
  initialIndex,
  opened,
  onClose,
  onUpdate,
}: OwnerLightboxProps) => {
  const lightboxItems = useMemo(
    () =>
      items.map((item) => ({
        id: item.id,
        url: item.url,
        type: (item.type === 'VIDEO' ? 'video' : 'image') as 'image' | 'video',
      })),
    [items],
  );

  const renderFooter = useCallback(
    (currentIndex: number) => {
      const item = items[currentIndex];
      if (!item) return null;
      return (
        <Group justify="space-between" align="center">
          <DateEditPopover
            value={item.capturedAt ? new Date(item.capturedAt) : undefined}
            selectedCount={1}
            onApply={(date) => void onUpdate(item.id, { capturedAt: date })}
          />
          <PriceEditPopover
            value={item.price / 100}
            selectedCount={1}
            onApply={(price) => void onUpdate(item.id, { price: Math.round(price * 100) })}
          />
        </Group>
      );
    },
    [items, onUpdate],
  );

  return (
    <CarouselLightbox
      items={lightboxItems}
      initialIndex={initialIndex}
      opened={opened}
      onClose={onClose}
      renderFooter={renderFooter}
    />
  );
});

OwnerLightbox.displayName = 'OwnerLightbox';
