'use client';

import React, { FC, memo } from 'react';
import { ActionIcon, Group } from '@mantine/core';
import { IconShoppingCart, IconHeart, IconShare, IconFlag } from '@tabler/icons-react';
import { MediaItem } from 'entities/Media/types';
import BaseCard from './BaseCard';

/**
 * Available action types for PublicCard
 */
export type PublicCardAction = 'cart' | 'favorites' | 'share' | 'report';

/**
 * Props for PublicCard component
 */
export interface PublicCardProps {
  /** Media item to display */
  mediaItem: MediaItem;

  /** Actions to display (cart, favorites, share, report) */
  actions?: PublicCardAction[];

  /** Callback when an action is triggered */
  onAction?: (action: PublicCardAction, id: string) => void;
}

/**
 * Action icon configuration
 */
const ACTION_ICONS: Record<
  PublicCardAction,
  { icon: typeof IconShoppingCart; label: string; color: string }
> = {
  cart: { icon: IconShoppingCart, label: 'Add to cart', color: 'blue' },
  favorites: { icon: IconHeart, label: 'Add to favorites', color: 'red' },
  share: { icon: IconShare, label: 'Share', color: 'gray' },
  report: { icon: IconFlag, label: 'Report', color: 'orange' },
};

/**
 * PublicCard - Card for published media in spot galleries, cart, favorites
 *
 * Features:
 * - Configurable action buttons (cart, favorites, share, report)
 * - Selection checkbox (via BaseCard)
 * - Clean design for public-facing galleries
 *
 * @example
 * ```tsx
 * <PublicCard
 *   mediaItem={item}
 *   actions={['cart', 'favorites']}
 *   onAction={(action, id) => {
 *     if (action === 'cart') addToCart(id);
 *     if (action === 'favorites') addToFavorites(id);
 *   }}
 *   selected={selection.isSelected(item.id)}
 * />
 * ```
 */
const PublicCard: FC<PublicCardProps> = memo(({
  mediaItem,
  actions = [],
  onAction,
}) => {
  const { resource } = mediaItem;

  return (
    <BaseCard
      imageUrl={resource.url}
      resourceType={resource.resource_type}
      playbackUrl={resource.playback_url}
      alt={`Media ${resource.asset_id}`}
      actions={
        actions.length > 0 ? (
          <Group gap="xs">
            {actions.map((actionType) => {
              const config = ACTION_ICONS[actionType];
              const Icon = config.icon;

              return (
                <ActionIcon
                  key={actionType}
                  variant="filled"
                  color={config.color}
                  size="md"
                  radius="xl"
                  aria-label={config.label}
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
