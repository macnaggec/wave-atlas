

import React, { FC, memo, useCallback } from 'react';
import { ActionIcon, Badge, Group } from '@mantine/core';
import { IconShoppingCartPlus, IconShoppingCartMinus, IconHeart, IconShare, IconFlag } from '@tabler/icons-react';
import { BaseCard } from 'shared/ui/BaseGallery';
import type { PublicCardAction } from '../../model/types';

export type { PublicCardAction };

/** Minimal display contract for PublicCard — only fields the card actually renders. */
export interface DisplayMedia {
  id: string;
  thumbnailUrl: string;
  resource: {
    resourceType: 'image' | 'video';
    url: string;
    playbackUrl?: string;
    assetId: string;
  };
}

/**
 * Props for PublicCard component
 */
export interface PublicCardProps {
  /** Media item to display */
  mediaItem: DisplayMedia;

  /** Actions to display (cart, favorites, share, report) */
  actions?: PublicCardAction[];

  /** Actions that are currently active/toggled on */
  activeActions?: PublicCardAction[];

  /** Callback when an action is triggered */
  onAction?: (action: PublicCardAction, id: string) => void;

  /** Callback when card is clicked to open lightbox */
  onCardClick?: (id: string) => void;

  /** Show owner badge overlay (e.g. in selection mode when item belongs to viewer) */
  showOwnerBadge?: boolean;

  /** Show purchased badge overlay when the viewer already owns this media */
  showPurchasedBadge?: boolean;
}

/**
 * Action icon configuration — default (inactive) state
 */
const ACTION_ICONS: Record<
  PublicCardAction,
  { icon: typeof IconShoppingCartPlus; label: string; color: string; variant: string }
> = {
  cart: {
    icon: IconShoppingCartPlus,
    label: 'Add to cart',
    color: 'green',
    variant: 'filled'
  },
  favorites: {
    icon: IconHeart,
    label: 'Add to favorites',
    color: 'red',
    variant: 'filled'
  },
  share: {
    icon: IconShare,
    label: 'Share',
    color: 'gray',
    variant: 'filled'
  },
  report: {
    icon: IconFlag,
    label: 'Report',
    color: 'orange',
    variant: 'filled'
  },
};

/**
 * Action icon configuration — active (toggled on) state
 */
const ACTION_ICONS_ACTIVE: Partial<Record<
  PublicCardAction,
  { icon: typeof IconShoppingCartPlus; label: string; color: string; variant: string }
>> = {
  cart: { icon: IconShoppingCartMinus, label: 'Remove from cart', color: 'red', variant: 'filled' },
};

/**
 * PublicCard - Card for published media in spot galleries, cart, favorites
 *
 * Features:
 * - Configurable action buttons (cart, favorites, share, report)
 * - Selection checkbox (via BaseCard)
 * - Clean design for public-facing galleries
 * - Parent controls which actions to show (empty array during selection mode)
 */
const OWNER_BADGE = (
  <Badge size="xs" variant="filled" color="gray" radius="sm">
    Yours
  </Badge>
);

const PURCHASED_BADGE = (
  <Badge size="xs" variant="filled" color="teal" radius="sm">
    Purchased
  </Badge>
);

const PublicCard: FC<PublicCardProps> = memo(({
  mediaItem,
  actions = [],
  activeActions = [],
  onAction,
  onCardClick,
  showOwnerBadge = false,
  showPurchasedBadge = false,
}) => {
  const { resource } = mediaItem;

  const handleClick = useCallback(() => {
    onCardClick?.(mediaItem.id);
  }, [onCardClick, mediaItem.id]);

  return (
    <BaseCard
      imageUrl={mediaItem.thumbnailUrl}
      resourceType={resource.resourceType}
      alt={`Media ${resource.assetId}`}
      onClick={onCardClick ? handleClick : undefined}
      overlays={showOwnerBadge ? OWNER_BADGE : showPurchasedBadge ? PURCHASED_BADGE : undefined}
      actions={
        actions.length > 0 ? (
          <Group gap="xs">
            {actions.map((actionType) => {
              const config = ACTION_ICONS[actionType];
              const isActive = activeActions.includes(actionType);
              const resolved = isActive && ACTION_ICONS_ACTIVE[actionType]
                ? { ...config, ...ACTION_ICONS_ACTIVE[actionType]! }
                : config;
              const Icon = resolved.icon;

              return (
                <ActionIcon
                  key={actionType}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Mantine variant type narrows too strictly for dynamic action configs
                  variant={resolved.variant as any}
                  color={resolved.color}
                  size="md"
                  radius="xl"
                  aria-label={resolved.label}
                  onClick={(e) => {
                    e.stopPropagation();
                    onAction?.(actionType, mediaItem.id);
                  }}
                >
                  <Icon size={16} />
                </ActionIcon>
              );
            })}
          </Group>
        ) : undefined
      }
    />
  );
});

PublicCard.displayName = 'PublicCard';

export default PublicCard;
