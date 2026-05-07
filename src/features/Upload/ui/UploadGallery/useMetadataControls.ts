import { useState, useCallback, useMemo } from 'react';
import { QueueItem } from '../../model';
import { MIN_MEDIA_PRICE_CENTS } from 'entities/Media/constants';

interface Selection {
  hasSelection: boolean;
  selectedIds: readonly string[];
  selectedItems: QueueItem[];
}

interface UseMetadataControlsProps {
  completedItems: QueueItem[];
  hasActiveUploads: boolean;
  selection: Selection;
  onBulkDateEdit?: (selectedIds: string[], date: Date) => void;
  onBulkPriceEdit?: (selectedIds: string[], price: number) => void;
}

/**
 * Hook to manage metadata controls state and handlers
 *
 * Encapsulates all logic for date/price editing including:
 * - State management for selected values
 * - Disabled state calculation
 * - Tooltip messages
 * - EXIF date detection
 * - Apply handlers with selection capture
 */
export function useMetadataControls({
  completedItems,
  hasActiveUploads,
  selection,
  onBulkDateEdit,
  onBulkPriceEdit,
}: UseMetadataControlsProps) {
  const { hasSelection, selectedIds, selectedItems } = selection;
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedPrice, setSelectedPrice] = useState<number>(MIN_MEDIA_PRICE_CENTS / 100);

  // Check if selected items (or all if none selected) have EXIF dates
  const hasExifDates = useMemo(() => {
    const targetItems = hasSelection ? selectedItems : completedItems;
    return targetItems.some(item => item.result?.dateSource === 'exif');
  }, [hasSelection, selectedItems, completedItems]);

  // Disable toolbar if no completed items OR if uploads are still in progress
  const isDisabled = completedItems.length === 0 || hasActiveUploads;

  // Tooltip message for disabled controls
  const tooltip = useMemo(() => {
    if (completedItems.length === 0) {
      return 'Upload files first to edit metadata';
    }
    if (hasActiveUploads) {
      return 'Wait for all uploads to complete';
    }
    return undefined;
  }, [completedItems.length, hasActiveUploads]);

  // Date apply handler - captures selection state at invocation time
  const handleDateApply = useCallback(
    (date: Date) => {
      const selectedIdsArray = Array.from(selectedIds);
      setSelectedDate(date);
      onBulkDateEdit?.(selectedIdsArray, date);
    },
    [selectedIds, onBulkDateEdit]
  );

  // Price apply handler - captures selection state at invocation time
  const handlePriceApply = useCallback(
    (price: number) => {
      const selectedIdsArray = Array.from(selectedIds);
      setSelectedPrice(price);
      onBulkPriceEdit?.(selectedIdsArray, price);
    },
    [selectedIds, onBulkPriceEdit]
  );

  return {
    selectedDate,
    selectedPrice,
    totalCount: completedItems.length,
    hasExifDates,
    isDisabled,
    tooltip,
    handleDateApply,
    handlePriceApply,
  };
}
