'use client';

import React, { FC, ReactNode, memo } from 'react';
import { Button, Group, Menu, Text, ActionIcon } from '@mantine/core';
import { IconDots } from '@tabler/icons-react';
import { UseGallerySelectionReturn } from 'shared/hooks/gallery';

/**
 * Props for SelectionToolbar component
 * @template T - Type of items in the gallery
 */
export interface SelectionToolbarProps<T> {
  /** Selection state from useGallerySelection hook */
  selection: UseGallerySelectionReturn<T>;

  /** Render function for menu actions - receives selected items */
  renderActions?: (selectedItems: T[]) => ReactNode;

  /** Render function for left content (e.g., metadata controls) - always visible */
  renderContent?: () => ReactNode;

  /** Hide toolbar when no items available to select (default: true) */
  hideWhenEmpty?: boolean;

  /** Optional custom labels */
  labels?: {
    select?: string;
    cancel?: string;
    selectAll?: string;
    deselectAll?: string;
    selectedCount?: (count: number) => string;
  };
}

/**
 * SelectionToolbar - Toolbar for item selection and bulk actions
 *
 * Replaces withSelect HOC's button UI. Shows "Select" button
 * that enables selection mode (showing checkboxes without selecting items).
 * When in selection mode, shows "Cancel" button to exit and displays
 * selected count and custom menu actions when items are selected.
 *
 * @example
 * ```tsx
 * const selection = useGallerySelection({ items, getId: (i) => i.id });
 *
 * <Gallery
 *   toolbar={
 *     <SelectionToolbar
 *       selection={selection}
 *       renderActions={(items) => (
 *         <>
 *           <Menu.Item onClick={() => addToCart(items)}>Add to Cart</Menu.Item>
 *           <Menu.Item onClick={() => deleteItems(items)}>Delete</Menu.Item>
 *         </>
 *       )}
 *     />
 *   }
 * />
 * ```
 */
const SelectionToolbar = memo(<T,>({
  selection,
  renderActions,
  renderContent,
  hideWhenEmpty = true,
  labels = {},
}: SelectionToolbarProps<T>) => {
  const {
    select: selectLabel = 'Select',
    cancel: cancelLabel = 'Cancel',
    selectAll: selectAllLabel = 'Select All',
    deselectAll: deselectAllLabel = 'Deselect All',
    selectedCount: selectedCountLabel = (count: number) => `${count} selected`,
  } = labels;

  // Note: hideWhenEmpty requires client to conditionally render since selection hook
  // doesn't expose total item count. Kept as prop for API consistency but currently no-op.
  // Client should use: {items.length > 0 && <SelectionToolbar ... />}

  return (
    <Group justify="space-between" mb="md">
      {/* Left: Actions menu + metadata content */}
      <Group gap="sm">
        {selection.isSelectionMode && renderActions && (
          <Menu position="bottom-start" withArrow>
            <Menu.Target>
              <Button
                variant="light"
                leftSection={<IconDots size={18} />}
                disabled={!selection.hasSelection}
              >
                Actions
              </Button>
            </Menu.Target>

            <Menu.Dropdown>
              {renderActions(selection.selectedItems)}
            </Menu.Dropdown>
          </Menu>
        )}

        {renderContent && renderContent()}
      </Group>

      {/* Right: Selection controls */}
      <Group gap="xs">
        {selection.isSelectionMode && (
          <Button
            variant="default"
            onClick={selection.isAllSelected ? selection.clearSelection : selection.selectAll}
          >
            {selection.isAllSelected ? deselectAllLabel : selectAllLabel}
          </Button>
        )}

        <Button
          variant={selection.isSelectionMode ? 'subtle' : 'light'}
          onClick={selection.isSelectionMode ? selection.disableSelectionMode : selection.enableSelectionMode}
        >
          {selection.isSelectionMode ? cancelLabel : selectLabel}
        </Button>
      </Group>
    </Group>
  );
}) as <T>(props: SelectionToolbarProps<T>) => React.ReactElement;

(SelectionToolbar as any).displayName = 'SelectionToolbar';

export default SelectionToolbar;
