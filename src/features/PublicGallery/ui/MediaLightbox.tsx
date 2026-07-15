import { FC, memo } from 'react';
import { ActionIcon, Group, Text, Badge, Tooltip } from '@mantine/core';
import { IconHeart, IconShoppingCartPlus, IconShoppingCartMinus } from '@tabler/icons-react';
import { formatPrice } from 'shared/lib/currency';
import { CarouselLightbox } from 'shared/ui/CarouselLightbox';

/** Normalized shape callers must produce before passing to MediaLightbox. */
export interface LightboxMedia {
  id: string;
  lightboxUrl: string;
  thumbnailUrl: string;
  type: 'image' | 'video';
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
  favoriteItemIds?: Set<string>;
  onFavoriteToggle?: (item: LightboxMedia) => void;
  ownedItemIds?: Set<string>;
  purchasedItemIds?: Set<string>;
}

/**
 * MediaLightbox - Full-size watermarked preview modal.
 * Caption above the image: price + date on the left. Control rail: add/remove cart button.
 */
const MediaLightbox: FC<MediaLightboxProps> = memo(({
  items,
  initialIndex,
  opened,
  onClose,
  cartItemIds = new Set<string>(),
  onCartToggle,
  favoriteItemIds = new Set<string>(),
  onFavoriteToggle,
  ownedItemIds = new Set<string>(),
  purchasedItemIds = new Set<string>(),
}) => {
  const lightboxItems = items.map((item) => ({
    id: item.id,
    url: item.lightboxUrl,
    type: item.type,
    alt: `Surf photo from ${new Date(item.capturedAt).toLocaleDateString()}`,
  }));

  return (
    <CarouselLightbox
      items={lightboxItems}
      initialIndex={initialIndex}
      opened={opened}
      onClose={onClose}
      renderOverlay={(itemIndex) => {
        const item = items[itemIndex];
        if (!item) return null;
        const isPurchased = purchasedItemIds.has(item.id);

        return (
          <Group gap="xs" wrap="nowrap">
            <Badge
              size="lg"
              variant={(item.price ?? 0) > 0 ? 'filled' : 'light'}
              color={(item.price ?? 0) > 0 ? 'blue' : 'gray'}
            >
              {formatPrice(item.price ?? 0)}
            </Badge>
            <Text size="sm" c="white" fw={600}>
              {new Date(item.capturedAt).toLocaleDateString()}
            </Text>
            {isPurchased && (
              <Badge size="lg" variant="filled" color="teal">
                Purchased
              </Badge>
            )}
          </Group>
        );
      }}
      renderActions={(currentIndex) => {
        const item = items[currentIndex];
        if (!item) return null;
        const isOwn = ownedItemIds.has(item.id);
        const isPurchased = purchasedItemIds.has(item.id);
        const isInCart = cartItemIds.has(item.id);
        const cartLabel = isInCart ? 'Remove from cart' : 'Add to cart';
        const isFavorite = favoriteItemIds.has(item.id);
        const favoriteLabel = isFavorite ? 'Remove from favorites' : 'Add to favorites';
        const canAddToCart = (item.price ?? 0) > 0 && !isOwn && !isPurchased && !!onCartToggle;

        if (!canAddToCart && !onFavoriteToggle) return null;

        return (
          <>
            {canAddToCart && (
              <Tooltip label={cartLabel} withArrow withinPortal zIndex={4000}>
                <ActionIcon
                  aria-label={cartLabel}
                  data-lightbox-icon-action="true"
                  data-lightbox-icon-frame="chip"
                  data-lightbox-tooltip-layer="above-media"
                  variant="subtle"
                  size={44}
                  radius="xl"
                  onClick={() => onCartToggle!(item)}
                >
                  {isInCart
                    ? <IconShoppingCartMinus size={24} stroke={2} />
                    : <IconShoppingCartPlus size={24} stroke={2} />
                  }
                </ActionIcon>
              </Tooltip>
            )}
            {onFavoriteToggle && (
              <Tooltip label={favoriteLabel} withArrow withinPortal zIndex={4000}>
                <ActionIcon
                  aria-label={favoriteLabel}
                  data-lightbox-icon-action="true"
                  data-lightbox-icon-frame="chip"
                  data-lightbox-tooltip-layer="above-media"
                  variant="subtle"
                  color={isFavorite ? 'red' : undefined}
                  size={44}
                  radius="xl"
                  onClick={() => onFavoriteToggle(item)}
                >
                  <IconHeart size={24} stroke={2} fill={isFavorite ? 'currentColor' : 'none'} />
                </ActionIcon>
              </Tooltip>
            )}
          </>
        );
      }}
    />
  );
});

MediaLightbox.displayName = 'MediaLightbox';

export default MediaLightbox;
