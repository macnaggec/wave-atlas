

import React, { FC, memo } from 'react';
import { Box } from '@mantine/core';
import styles from './SelectionCheckbox.module.css';

export interface SelectionCheckboxProps {
  checked: boolean;
}

const SelectionCheckbox: FC<SelectionCheckboxProps> = memo(({ checked }) => {
  return (
    <Box className={styles.checkbox} data-checked={checked}>
      {checked ? (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" fill="rgba(255,255,255,0.18)" stroke="rgba(255,255,255,0.75)" strokeWidth="1.5" />
          <path d="M9 12l2 2 4-4" stroke="rgba(255,255,255,0.95)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" />
        </svg>
      )}
    </Box>
  );
});

SelectionCheckbox.displayName = 'SelectionCheckbox';
export default SelectionCheckbox;
