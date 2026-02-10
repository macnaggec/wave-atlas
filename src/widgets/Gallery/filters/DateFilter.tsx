'use client';

import React, { FC } from 'react';
import { DatePickerPopover } from 'shared/ui/DatePickerPopover';

/**
 * Props for DateFilter component
 */
export interface DateFilterProps {
  /** Current filter date value */
  value?: Date | null;

  /** Callback when date filter is applied */
  onApply: (date: Date) => void;

  /** Callback when filter is cancelled */
  onCancel?: () => void;

  /** Whether the filter is disabled */
  disabled?: boolean;

  /** Custom button label (e.g., "All Dates", "Jan 15, 2026") */
  buttonLabel?: string;
}

/**
 * DateFilter - Date filtering wrapper for DatePickerPopover
 *
 * Wraps the base DatePickerPopover for filtering gallery items by date.
 * Used in Gallery FilterToolbar for querying items.
 *
 * @example
 * ```tsx
 * <DateFilter
 *   value={filterDate}
 *   onApply={(date) => setDateFilter(date)}
 *   buttonLabel={filterDate ? formatDate(filterDate) : "All Dates"}
 * />
 * ```
 */
export const DateFilter: FC<DateFilterProps> = ({
  value,
  onApply,
  onCancel,
  disabled = false,
  buttonLabel,
}) => {
  return (
    <DatePickerPopover
      value={value}
      onApply={onApply}
      onCancel={onCancel}
      disabled={disabled}
      color="gray"
      showTimeRange={false}
      buttonLabel={buttonLabel}
    />
  );
};

export default DateFilter;
