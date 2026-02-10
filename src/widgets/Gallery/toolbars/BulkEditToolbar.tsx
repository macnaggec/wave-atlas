'use client';

import React, { FC, memo, useState } from 'react';
import { Group, Button } from '@mantine/core';
import { IconCalendar, IconCurrencyDollar } from '@tabler/icons-react';
import { DateEditPopover } from 'features/Upload/DateEditPopover';
import { PriceEditPopover } from 'features/Upload/PriceEditPopover';

/**
 * Props for BulkEditToolbar component
 */
export interface BulkEditToolbarProps {
  /** Array of selected item IDs */
  selectedIds: string[];

  /** Callback when bulk date edit is applied */
  onBulkDateEdit: (ids: string[], date: Date) => void;

  /** Callback when bulk price edit is applied */
  onBulkPriceEdit: (ids: string[], price: number) => void;
}

/**
 * BulkEditToolbar - Toolbar for bulk editing selected items
 *
 * Provides date and price popovers that apply changes to all
 * selected items. Used in upload tab for batch metadata editing.
 *
 * @example
 * ```tsx
 * const selection = useGallerySelection({ items, getId: (i) => i.id });
 *
 * <Gallery
 *   toolbar={
 *     selection.hasSelection ? (
 *       <BulkEditToolbar
 *         selectedIds={selection.selectedIds}
 *         onBulkDateEdit={handleBulkDateEdit}
 *         onBulkPriceEdit={handleBulkPriceEdit}
 *       />
 *     ) : null
 *   }
 * />
 * ```
 */
const BulkEditToolbar: FC<BulkEditToolbarProps> = memo(({
  selectedIds,
  onBulkDateEdit,
  onBulkPriceEdit,
}) => {
  const handleDateApply = (date: Date) => {
    onBulkDateEdit(selectedIds, date);
  };

  const handlePriceApply = (price: number) => {
    onBulkPriceEdit(selectedIds, price);
  };

  if (selectedIds.length === 0) return null;

  return (
    <Group gap="md" mb="md">
      <DateEditPopover onApply={handleDateApply} />
      <PriceEditPopover onApply={handlePriceApply} />
    </Group>
  );
});

BulkEditToolbar.displayName = 'BulkEditToolbar';

export default BulkEditToolbar;
