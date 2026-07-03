

import React, { FC, ReactNode, memo } from 'react';
import { Box } from '@mantine/core';
import { IconPlayerPlay } from '@tabler/icons-react';
import classes from './BaseCard.module.css';

/**
 * Props for BaseCard component
 */
export interface BaseCardProps {
  /** Image URL (JPEG poster frame for videos, thumbnail for images) */
  imageUrl: string;

  /** Resource type - image or video */
  resourceType: 'image' | 'video';

  /** Alt text for accessibility */
  alt?: string;

  /** Optional overlay content (stacked over image in top-left) */
  overlays?: ReactNode;

  /** Optional action content (positioned bottom-right or as context menu) */
  actions?: ReactNode;

  /** Optional className for customization */
  className?: string;

  /** Click handler for the card (e.g. open lightbox) */
  onClick?: () => void;
}

/**
 * BaseCard - Foundation card component for all gallery cards
 *
 * Renders a static thumbnail (always an <img>) with optional overlays, actions,
 * and a play indicator for video cards. Video playback belongs in the lightbox.
 */
const BaseCard: FC<BaseCardProps> = memo(({
  imageUrl,
  resourceType,
  alt = 'Media',
  overlays,
  actions,
  className,
  onClick,
}) => {
  return (
    <Box
      className={`${classes.card} ${className || ''}`}
      data-media-card-aspect="tall"
      onClick={onClick}
    >
      {imageUrl && (
        <img
          src={imageUrl}
          alt={alt}
          className={classes.nativeMedia}
        />
      )}

      {resourceType === 'video' && (
        <div className={classes.videoIndicator}>
          <IconPlayerPlay size={14} />
        </div>
      )}

      {/* Overlays slot (top-left: date/price badges, metadata) */}
      {overlays && (
        <Box className={classes.overlays}>
          {overlays}
        </Box>
      )}

      {/* Actions slot (bottom-right: cart, favorites, delete buttons) */}
      {actions && (
        <Box
          className={classes.actions}
          data-gallery-card-actions="glass"
          onClick={(e) => e.stopPropagation()}
        >
          {actions}
        </Box>
      )}
    </Box>
  );
});

BaseCard.displayName = 'BaseCard';

export default BaseCard;
