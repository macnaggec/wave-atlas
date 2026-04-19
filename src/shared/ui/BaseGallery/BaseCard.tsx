'use client';

import React, { FC, ReactNode, memo } from 'react';
import { Box } from '@mantine/core';
import Video from './Video';
import classes from './BaseCard.module.css';

/**
 * Props for BaseCard component
 */
export interface BaseCardProps {
  /** Image or video URL (supports both blob:// and https://) */
  imageUrl: string;

  /** Resource type - image or video */
  resourceType: 'image' | 'video';

  /** Video playback URL (required for video type) */
  playbackUrl?: string;

  /** Alt text for accessibility */
  alt?: string;

  /** Optional overlay content (stacked over image/video in top-left) */
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
 * Pure presentation component that renders image or video with optional
 * overlays, actions, and selection indicator. Decoupled from MediaItem
 * entity to work with both uploads (blob URLs) and published media.
 *
 * @example
 * ```tsx
 * <BaseCard
 *   imageUrl="https://res.cloudinary.com/..."
 *   resourceType="image"
 *   alt="Beach sunset"
 *   overlays={<DateBadge date={date} />}
 *   actions={<ActionButton onClick={handleDelete} />}
 *   selected={isSelected}
 * />
 * ```
 */
const BaseCard: FC<BaseCardProps> = memo(({
  imageUrl,
  resourceType,
  playbackUrl,
  alt = 'Media',
  overlays,
  actions,
  className,
  onClick,
}) => {
  return (
    <Box
      className={`${classes.card} ${className || ''}`}
      onClick={onClick}
    >
      {/* Image or Video */}
      {resourceType === 'image' && (
        <img
          src={imageUrl}
          alt={alt}
          className={classes.nativeMedia}
        />
      )}

      {resourceType === 'video' && (
        playbackUrl ? (
          <Video
            playbackUrl={playbackUrl}
            controls
          />
        ) : (
          <video
            src={imageUrl}
            className={classes.nativeMedia}
            controls
            preload="metadata"
          />
        )
      )}

      {/* Overlays slot (top-left: date/price badges, metadata) */}
      {overlays && (
        <Box className={classes.overlays}>
          {overlays}
        </Box>
      )}

      {/* Actions slot (bottom-right: cart, favorites, delete buttons) */}
      {actions && (
        <Box className={classes.actions}>
          {actions}
        </Box>
      )}
    </Box>
  );
});

BaseCard.displayName = 'BaseCard';

export default BaseCard;
