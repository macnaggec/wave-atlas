'use client';

import { useCallback, useMemo, useState } from 'react';

/**
 * Options for useGallerySelection hook
 * @template T - Type of items in the gallery
 */
export interface UseGallerySelectionOptions<T> {
  /** Array of items that can be selected */
  items: T[];
  /** Function to extract unique ID from each item */
  getId: (item: T) => string;
  /** Optional initial selection */
  initialSelection?: string[];
}

/**
 * Return value from useGallerySelection hook
 * @template T - Type of items in the gallery
 */
export interface UseGallerySelectionReturn<T> {
  /** Array of selected item IDs (readonly to prevent external mutation) */
  selectedIds: readonly string[];
  /** Number of selected items */
  selectedCount: number;
  /** Whether all available items are selected */
  isAllSelected: boolean;
  /** Array of selected items (derived from selectedIds) */
  selectedItems: T[];
  /** Check if an item is selected */
  isSelected: (id: string) => boolean;
  /** Toggle selection for a single item */
  toggle: (id: string) => void;
  /** Select all items */
  selectAll: () => void;
  /** Clear all selections */
  clearSelection: () => void;
  /** Whether any items are selected */
  hasSelection: boolean;
  /** Whether selection mode is enabled (shows checkboxes) */
  isSelectionMode: boolean;
  /** Enable selection mode */
  enableSelectionMode: () => void;
  /** Disable selection mode (without clearing selections) */
  disableSelectionMode: () => void;
}

/**
 * Hook for managing gallery item selection state
 *
 * Replaces withSelect HOC pattern with composable hook.
 * Manages selection state using Set for O(1) lookup performance.
 *
 * @example
 * ```tsx
 * const selection = useGallerySelection({
 *   items: mediaItems,
 *   getId: (item) => item.id,
 * });
 *
 * <Gallery
 *   renderCard={(item) => (
 *     <Card
 *       selected={selection.isSelected(item.id)}
 *       onClick={() => selection.toggle(item.id)}
 *     />
 *   )}
 * />
 * ```
 */
export function useGallerySelection<T>({
  items,
  getId,
  initialSelection = [],
}: UseGallerySelectionOptions<T>): UseGallerySelectionReturn<T> {
  // Use Set for O(1) lookup instead of array
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(initialSelection)
  );

  // Track whether selection mode is enabled
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  // Check if an item is selected
  const isSelected = useCallback(
    (id: string) => selectedIds.has(id),
    [selectedIds]
  );

  // Toggle selection for a single item
  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Select all items in current gallery
  const selectAll = useCallback(() => {
    const allIds = items.map(getId);
    setSelectedIds(new Set(allIds));
  }, [items, getId]);

  // Clear all selections
  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Enable selection mode
  const enableSelectionMode = useCallback(() => {
    setIsSelectionMode(true);
  }, []);

  // Disable selection mode (without clearing selections)
  const disableSelectionMode = useCallback(() => {
    setIsSelectionMode(false);
  }, []);

  // Derive selected items array (memoized to prevent re-creation)
  const selectedItems = useMemo(() => {
    return items.filter((item) => selectedIds.has(getId(item)));
  }, [items, selectedIds, getId]);

  // Derive readonly array of selected IDs
  const selectedIdsArray = useMemo(() => {
    return Array.from(selectedIds);
  }, [selectedIds]);

  // Computed values
  const selectedCount = selectedIds.size;
  const hasSelection = selectedCount > 0;
  const isAllSelected = selectedCount === items.length && items.length > 0;

  return {
    selectedIds: selectedIdsArray,
    selectedCount,
    isAllSelected,
    selectedItems,
    isSelected,
    toggle,
    selectAll,
    clearSelection,
    hasSelection,
    isSelectionMode,
    enableSelectionMode,
    disableSelectionMode,
  };
}
