'use client';

import { memo, useCallback } from 'react';
import { ActionIcon } from '@mantine/core';
import { IconX } from '@tabler/icons-react';

interface DeleteButtonProps {
  onRemove: (id: string) => Promise<void>;
  itemId: string;
}

/**
 * DeleteButton - Memoized delete button for upload items
 * 
 * Prevents icon blob URL regeneration and stays stable across re-renders.
 */
export const DeleteButton = memo<DeleteButtonProps>(
  ({ onRemove, itemId }) => {
    const handleClick = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        void onRemove(itemId);
      },
      [onRemove, itemId]
    );

    return (
      <ActionIcon
        variant="filled"
        color="red"
        size="sm"
        radius="xl"
        onClick={handleClick}
      >
        <IconX size={14} />
      </ActionIcon>
    );
  },
  // Custom comparison: only re-render if itemId changes
  (prevProps, nextProps) => prevProps.itemId === nextProps.itemId
);

DeleteButton.displayName = 'DeleteButton';
