'use client';

import React, { FC, memo, useCallback } from 'react';
import { ActionIcon, Group } from '@mantine/core';
import { IconShoppingCartPlus, IconShoppingCartMinus, IconHeart, IconShare, IconFlag } from '@tabler/icons-react';
import { MediaItem } from 'entities/Media/types';
import { BaseCard } from 'shared/ui/BaseGallery';

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

  /** Actions that are currently active/toggled on */
  activeActions?: PublicCardAction[];

  /** Callback when an action is triggered */
  onAction?: (action: PublicCardAction, id: string) => void;

  /** Callback when card is clicked to open lightbox */
  onCardClick?: (id: string) => void;
}

/**
 * Action icon configuration — default (inactive) state
 */
const ACTION_ICONS: Record<
  PublicCardAction,
  { icon: typeof IconShoppingCartPlus; label: string; color: string; variant: string }
> = {
  cart: { icon: IconShoppingCartPlus, label: 'Add to cart', color: 'green', variant: 'filled' },
  favorites: { icon: IconHeart, label: 'Add to favorites', color: 'red', variant: 'filled' },
  share: { icon: IconShare, label: 'Share', color: 'gray', variant: 'filled' },
  report: { icon: IconFlag, label: 'Report', color: 'orange', variant: 'filled' },
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
const PublicCard: FC<PublicCardProps> = memo(({
  mediaItem,
  actions = [],
  activeActions = [],
  onAction,
  onCardClick,
}) => {
  const { resource } = mediaItem;
  const thumbnailUrl = resource.resource_type === 'image'
    ? mediaItem.thumbnailUrl
    : resource.url;

  const handleClick = useCallback(() => {
    onCardClick?.(mediaItem.id);
  }, [onCardClick, mediaItem.id]);

  return (
    <BaseCard
      imageUrl={thumbnailUrl}
      resourceType={resource.resource_type}
      playbackUrl={resource.playback_url}
      alt={`Media ${resource.asset_id}`}
      onClick={onCardClick ? handleClick : undefined}
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
