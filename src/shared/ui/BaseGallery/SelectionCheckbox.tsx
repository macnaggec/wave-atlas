'use client';

import React, { FC, memo } from 'react';
import { Box } from '@mantine/core';
import styles from './SelectionCheckbox.module.css';

/**
 * Props for SelectionCheckbox component
 */
export interface SelectionCheckboxProps {
  /** Whether the checkbox is checked */
  checked: boolean;
}

/**
 * SelectionCheckbox - Checkbox overlay for gallery selection
 *
 * Displays in top-right corner of gallery cards. Shows as unchecked
 * circle in selection mode, and blue circle with checkmark when selected.
 *
 * @example
 * ```tsx
 * <SelectionCheckbox checked={isSelected} />
 * ```
 */
const SelectionCheckbox: FC<SelectionCheckboxProps> = memo(({ checked }) => {
  return (
    <Box className={styles.checkbox} data-checked={checked}>
      {checked ? (
        // Checked state
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" fill="var(--mantine-color-blue-6)" />
          <path
            d="M9 12l2 2 4-4"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        // Unchecked state
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <circle
            cx="12"
            cy="12"
            r="10"
            fill="rgba(255, 255, 255, 0.9)"
            stroke="var(--mantine-color-gray-5)"
            strokeWidth="2"
          />
        </svg>
      )}
    </Box>
  );
});

SelectionCheckbox.displayName = 'SelectionCheckbox';

export default SelectionCheckbox;
