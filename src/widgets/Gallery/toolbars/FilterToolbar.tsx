'use client';

import React, { FC, memo, useState, useMemo } from 'react';
import { Group, Button, Badge, Popover, Stack } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconFilter } from '@tabler/icons-react';
import { GalleryFilters } from 'shared/hooks/gallery';

/**
 * Props for FilterToolbar component
 */
export interface FilterToolbarProps {
  /** Draft filters (being edited, bound to inputs) */
  draftFilters: GalleryFilters;

  /** Update draft filters callback */
  setDraftFilters: (filters: Partial<GalleryFilters>) => void;

  /** Apply draft filters → update applied state + URL */
  applyFilters: () => void;

  /** Clear both draft and applied filters */
  clearFilters: () => void;

  /** Whether draft differs from applied (for Apply button enable) */
  hasUnappliedChanges: boolean;

  /** Applied filters (for computing active count) */
  appliedFilters: GalleryFilters;
}

/**
 * FilterToolbar - Toolbar for filtering gallery items with Apply button pattern
 *
 * Provides UI controls for date filtering with draft/apply workflow.
 * Works with useGalleryFilterState hook for state management.
 *
 * @example
 * ```tsx
 * const {
 *   filters,
 *   draftFilters,
 *   setDraftFilters,
 *   applyFilters,
 *   clearFilters,
 *   hasUnappliedChanges,
 * } = useGalleryFilterState();
 *
 * <Gallery
 *   items={items}
 *   toolbar={
 *     <FilterToolbar
 *       draftFilters={draftFilters}
 *       setDraftFilters={setDraftFilters}
 *       applyFilters={applyFilters}
 *       clearFilters={clearFilters}
 *       hasUnappliedChanges={hasUnappliedChanges}
 *       appliedFilters={filters}
 *     />
 *   }
 * />
 * ```
 */
const FilterToolbar: FC<FilterToolbarProps> = memo(({
  draftFilters,
  setDraftFilters,
  applyFilters,
  clearFilters,
  hasUnappliedChanges,
  appliedFilters,
}) => {
  const [opened, setOpened] = useState(false);

  // Count active filters from applied state
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (appliedFilters.date) count++;
    return count;
  }, [appliedFilters]);

  const handleDateChange = (value: Date | null | string) => {
    if (value instanceof Date) {
      setDraftFilters({ date: value.toISOString().split('T')[0] });
    } else if (typeof value === 'string') {
      setDraftFilters({ date: value });
    } else {
      setDraftFilters({ date: undefined });
    }
  };

  const handleApply = () => {
    applyFilters();
    setOpened(false);
  };

  const handleClear = () => {
    clearFilters();
    setOpened(false);
  };

  // Parse ISO date string back to Date for DatePickerInput
  const dateValue = draftFilters.date ? new Date(draftFilters.date) : null;

  return (
    <Group justify="flex-start" mb="md">
      <Popover opened={opened} onChange={setOpened} position="bottom-start" withArrow>
        <Popover.Target>
          <Button
            variant="light"
            leftSection={<IconFilter size={16} />}
            rightSection={
              activeFiltersCount > 0 ? (
                <Badge size="sm" variant="filled" color="blue">
                  {activeFiltersCount}
                </Badge>
              ) : undefined
            }
            onClick={() => setOpened((o) => !o)}
          >
            Filters
          </Button>
        </Popover.Target>

        <Popover.Dropdown>
          <Stack gap="md" style={{ minWidth: 300 }}>
            <DatePickerInput
              label="Date"
              placeholder="Select date"
              value={dateValue}
              onChange={handleDateChange}
              clearable
            />

            <Group justify="space-between">
              <Button variant="subtle" size="sm" onClick={handleClear}>
                Clear
              </Button>
              <Button
                size="sm"
                onClick={handleApply}
                disabled={!hasUnappliedChanges}
              >
                Apply
              </Button>
            </Group>
          </Stack>
        </Popover.Dropdown>
      </Popover>
    </Group>
  );
});

FilterToolbar.displayName = 'FilterToolbar';

export default FilterToolbar;
