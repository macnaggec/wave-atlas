'use client';

import React, { FC, memo } from 'react';
import { Group, Button } from '@mantine/core';
import { UseGallerySelectionReturn } from 'shared/hooks/gallery';

/**
 * Props for BulkEditToolbar component
 */
export interface BulkEditToolbarProps<T> {
  /** Selection state from useGallerySelection hook */
  selection: UseGallerySelectionReturn<T>;

  /** Callback for bulk date edit */
  onBulkDateEdit?: (selectedIds: string[], date: Date) => void;

  /** Callback for bulk price edit */
  onBulkPriceEdit?: (selectedIds: string[], price: number) => void;
}

/**
 * BulkEditToolbar - Toolbar with bulk editing actions for selected drafts
 *
 * Provides date and price editing popovers that operate on all selected items.
 * Used in conjunction with Gallery's SelectionToolbar.
 *
 * @example
 * ```tsx
 * const selection = useGallerySelection({ items, getId: (i) => i.id });
 *
 * <Gallery
 *   toolbar={
 *     <Group>
 *       <SelectionToolbar selection={selection} />
 *       {selection.hasSelection && (
 *         <BulkEditToolbar
 *           selection={selection}
 *           onBulkDateEdit={handleBulkDate}
 *           onBulkPriceEdit={handleBulkPrice}
 *         />
 *       )}
 *     </Group>
 *   }
 * />
 * ```
 */
const BulkEditToolbar = memo(<T,>({
  selection,
  onBulkDateEdit,
  onBulkPriceEdit,
}: BulkEditToolbarProps<T>) => {
  if (!selection.hasSelection) {
    return null;
  }

  return (
    <Group gap="sm">
      {/* TODO: Integrate DateEditPopover for bulk operations */}
      {/* TODO: Integrate PriceEditPopover for bulk operations */}

      <Button variant="light" size="sm" disabled>
        Edit Date ({selection.selectedCount})
      </Button>

      <Button variant="light" size="sm" disabled>
        Edit Price ({selection.selectedCount})
      </Button>
    </Group>
  );
}) as <T>(props: BulkEditToolbarProps<T>) => React.ReactElement;

(BulkEditToolbar as any).displayName = 'BulkEditToolbar';

export default BulkEditToolbar;
