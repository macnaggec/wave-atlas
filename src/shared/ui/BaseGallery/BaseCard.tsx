

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

  /** Single glyph anchored to the top-left corner over a darkening scrim (dense grids). */
  cornerGlyph?: ReactNode;

  /** Optional action content (positioned bottom-right or as context menu) */
  actions?: ReactNode;

  /** Optional className for customization */
  className?: string;

  /** Drop the corner radius for gapless, edge-to-edge dense grids. */
  flush?: boolean;

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
  cornerGlyph,
  actions,
  className,
  flush = false,
  onClick,
}) => {
  return (
    <Box
      className={`${classes.card} ${className || ''}`}
      data-media-card-aspect="tall"
      data-media-card-flush={flush || undefined}
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
          <IconPlayerPlay size={16} />
        </div>
      )}

      {/* Overlays slot (top-left: date/price badges, metadata) */}
      {overlays && (
        <Box className={classes.overlays}>
          {overlays}
        </Box>
      )}

      {/* Corner glyph slot (top-left corner: single state glyph over a scrim) */}
      {cornerGlyph && (
        <Box className={classes.cornerGlyph}>
          {cornerGlyph}
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
