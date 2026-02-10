'use client';

import { MediaItem } from 'entities/Media/types';
import { Badge, Box, Group, Stack, Text } from '@mantine/core';
import { FC, memo } from 'react';
import MediaCard from './MediaCard';
import classes from './DraftMediaCard.module.css';

export interface DraftMediaCardProps {
  mediaItem: MediaItem;
  isSelected?: boolean;
  showValidation?: boolean;
}

/**
 * DraftMediaCard - Specialized card for draft uploads
 *
 * Features:
 * - Metadata overlay (price, date)
 * - Auto badge for EXIF-extracted dates
 * - Red border when missing required fields
 * - Selection checkbox on hover (handled by withSelect HOC)
 */
const DraftMediaCard: FC<DraftMediaCardProps> = memo(({
  mediaItem,
  isSelected = false,
  showValidation = true,
}) => {
  const isDateFromExif = mediaItem.dateSource === 'exif';
  const isMissingDate = !mediaItem.capturedAt;
  const hasValidationError = showValidation && isMissingDate;

  const formatPrice = (price: number) => {
    return price === 0 ? 'Free' : `$${price.toFixed(2)}`;
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <Box
      className={classes.wrapper}
      data-selected={isSelected}
      data-error={hasValidationError}
    >
      {/* Base media card (image/video) */}
      <Box className={classes.media}>
        <MediaCard mediaItem={mediaItem} />
      </Box>

      {/* Metadata overlay */}
      <Box className={classes.overlay}>
        <Stack gap={4}>
          {/* Price */}
          <Group gap={4} align="center">
            <Text size="xs" fw={600} c="white" className={classes.price}>
              {formatPrice(mediaItem.price)}
            </Text>
          </Group>

          {/* Date with Auto badge */}
          <Group gap={4} align="center">
            {isMissingDate ? (
              <Badge size="xs" color="red" variant="filled">
                Missing Date
              </Badge>
            ) : (
              <>
                <Text size="xs" c="white" className={classes.date}>
                  {formatDate(mediaItem.capturedAt)}
                </Text>
                {isDateFromExif && (
                  <Badge size="xs" color="blue" variant="light">
                    Auto
                  </Badge>
                )}
              </>
            )}
          </Group>
        </Stack>
      </Box>

      {/* Validation error border */}
      {hasValidationError && (
        <Box className={classes.errorBorder} />
      )}
    </Box>
  );
});

DraftMediaCard.displayName = 'DraftMediaCard';

export default DraftMediaCard;
