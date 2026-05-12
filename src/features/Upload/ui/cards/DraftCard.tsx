'use client';

import React, { FC, ReactNode, memo } from 'react';
import { Box } from '@mantine/core';
import { MediaItem } from 'entities/Media/types';
import { BaseCard } from 'shared/ui/BaseGallery';
import classes from './DraftCard.module.css';

/**
 * Validation state for a draft card
 */
export interface ValidationState {
  /** Whether the card has validation errors */
  hasError: boolean;
  /** Optional error message */
  message?: string;
}

/**
 * Props for DraftCard component
 */
export interface DraftCardProps {
  /** Image or video URL (blob:// for uploads, https:// for drafts) */
  imageUrl: string;

  /** Resource type */
  resourceType: 'image' | 'video';

  /** Video playback URL (for videos) */
  playbackUrl?: string;

  /** Alt text */
  alt?: string;

  /** Overlay content (date/price or upload progress) */
  overlays?: ReactNode;

  /** Optional action content */
  actions?: ReactNode;

  /** Validation state (shows red border if hasError) */
  validation?: ValidationState;
}

/**
 * DraftCard - Specialized card for draft uploads in the Upload feature
 *
 * Wraps BaseCard with validation border logic. Accepts overlay slot
 * to display either upload progress or draft metadata.
 *
 * @example
 * ```tsx
 * // With draft metadata
 * <DraftCard
 *   imageUrl={item.result.resource.url}
 *   resourceType={item.result.resource.resource_type}
 *   overlays={<DraftOverlays mediaItem={item.result} />}
 *   validation={{ hasError: !item.result.capturedAt }}
 * />
 * ```
 */
const DraftCard: FC<DraftCardProps> = memo(({
  imageUrl,
  resourceType,
  playbackUrl,
  alt,
  overlays,
  actions,
  validation,
}) => {
  return (
    <Box className={validation?.hasError ? classes.error : undefined}>
      <BaseCard
        imageUrl={imageUrl}
        resourceType={resourceType}
        playbackUrl={playbackUrl}
        alt={alt}
        overlays={overlays}
        actions={actions}
      />
    </Box>
  );
});

DraftCard.displayName = 'DraftCard';

export default DraftCard;
