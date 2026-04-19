'use client';

import React, { FC, memo } from 'react';
import { Badge, Group } from '@mantine/core';
import { MediaItem } from 'entities/Media/types';
import { formatPrice } from 'shared/lib/currency';

/**
 * Props for DraftOverlays component
 */
export interface DraftOverlaysProps {
  /** Media item with draft metadata */
  mediaItem: MediaItem;

  /** Callback when date is edited */
  onDateEdit?: (id: string, date: Date) => void;

  /** Callback when price is edited */
  onPriceEdit?: (id: string, price: number) => void;
}

/**
 * DraftOverlays - Display badges for completed draft uploads
 *
 * Shows date, price, and EXIF auto badge for draft media items.
 * Used as overlay slot content in DraftCard.
 *
 * @example
 * ```tsx
 * <DraftCard
 *   mediaItem={item}
 *   overlays={
 *     <DraftOverlays
 *       mediaItem={item}
 *       onDateEdit={handleDateEdit}
 *       onPriceEdit={handlePriceEdit}
 *     />
 *   }
 * />
 * ```
 */
const DraftOverlays: FC<DraftOverlaysProps> = memo(({
  mediaItem,
  onDateEdit,
  onPriceEdit,
}) => {
  const isDateFromExif = mediaItem.dateSource === 'exif';

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <Group gap="xs">
      {/* Price Badge */}
      <Badge size="sm" color="green" variant="filled">
        {formatPrice(mediaItem.price)}
      </Badge>

      {/* Date Badge or Missing Date */}
      {mediaItem.capturedAt ? (
        <Badge size="sm" color="blue" variant="filled">
          {formatDate(mediaItem.capturedAt)}
        </Badge>
      ) : (
        <Badge size="sm" color="red" variant="filled">
          Missing Date
        </Badge>
      )}

      {/* EXIF Auto Badge */}
      {isDateFromExif && (
        <Badge size="xs" color="cyan" variant="light">
          Auto
        </Badge>
      )}
    </Group>
  );
});

DraftOverlays.displayName = 'DraftOverlays';

export default DraftOverlays;
