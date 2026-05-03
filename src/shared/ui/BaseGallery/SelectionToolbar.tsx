'use client';

import React, { ReactNode, memo } from 'react';
import { Button, Group, Menu } from '@mantine/core';
import { IconDots } from '@tabler/icons-react';
import { UseGallerySelectionReturn } from 'shared/hooks/gallery';

export interface SelectionToolbarProps<T> {
  selection: UseGallerySelectionReturn<T>;
  renderActions?: (selectedItems: T[]) => ReactNode;
  hasActions?: (selectedItems: T[]) => boolean;
  renderContent?: () => ReactNode;
}

const SelectionToolbar = memo(<T,>({
  selection,
  renderActions,
  hasActions,
  renderContent,
}: SelectionToolbarProps<T>) => {
  return (
    <Group justify="space-between" mb="md">
      {/* Left: Actions menu + metadata content */}
      <Group gap="sm">
        {selection.isSelectionMode && renderActions && hasActions?.(selection.selectedItems) !== false && (
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
            {selection.isAllSelected ? 'Deselect All' : 'Select All'}
          </Button>
        )}

        <Button
          variant={selection.isSelectionMode ? 'subtle' : 'light'}
          onClick={selection.isSelectionMode ? selection.disableSelectionMode : selection.enableSelectionMode}
        >
          {selection.isSelectionMode ? 'Cancel' : 'Select'}
        </Button>
      </Group>
    </Group>
  );
}) as <T>(props: SelectionToolbarProps<T>) => React.ReactElement;

(SelectionToolbar as React.MemoExoticComponent<React.FC>).displayName = 'SelectionToolbar';

export default SelectionToolbar;
