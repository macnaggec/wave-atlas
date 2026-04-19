'use client';

import { useMemo } from 'react';
import { Group } from '@mantine/core';
import { DateEditPopover, PriceEditPopover } from '../popovers';

interface MetadataControlsProps {
  /** Whether to show date edit popover */
  showDateEdit: boolean;
  /** Whether to show price edit popover */
  showPriceEdit: boolean;
  /** Current date value */
  selectedDate: Date;
  /** Current price value */
  selectedPrice: number;
  /** Number of selected items */
  selectedCount: number;
  /** Total number of completed items */
  totalCount: number;
  /** Whether any items have EXIF dates */
  hasExifDates: boolean;
  /** Whether controls are disabled */
  disabled: boolean;
  /** Tooltip text when disabled */
  tooltip?: string;
  /** Callback when date is applied */
  onDateApply: (date: Date) => void;
  /** Callback when price is applied */
  onPriceApply: (price: number) => void;
}

/**
 * MetadataControls - Date and price editing popovers
 *
 * Always visible but disabled when appropriate (no completed items or active uploads).
 * Shows contextual tooltips explaining why controls are disabled.
 */
export function MetadataControls({
  showDateEdit,
  showPriceEdit,
  selectedDate,
  selectedPrice,
  selectedCount,
  totalCount,
  hasExifDates,
  disabled,
  tooltip,
  onDateApply,
  onPriceApply,
}: MetadataControlsProps) {
  return (
    <Group gap="sm">
      {showDateEdit && (
        <DateEditPopover
          value={selectedDate}
          selectedCount={selectedCount}
          totalCount={totalCount}
          hasExifDates={hasExifDates}
          disabled={disabled}
          tooltip={tooltip}
          onApply={onDateApply}
        />
      )}
      {showPriceEdit && (
        <PriceEditPopover
          value={selectedPrice}
          selectedCount={selectedCount}
          totalCount={totalCount}
          disabled={disabled}
          tooltip={tooltip}
          onApply={onPriceApply}
        />
      )}
    </Group>
  );
}
