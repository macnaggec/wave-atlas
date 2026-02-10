'use client';

import React, { FC, useState, useEffect, useMemo } from 'react';
import { Popover, Button, Stack, NumberInput, Text, Box, Group } from '@mantine/core';
import { IconCurrencyDollar, IconChevronDown } from '@tabler/icons-react';
import { useFocusTrap } from '@mantine/hooks';

/**
 * Props for PriceEditPopover component
 */
export interface PriceEditPopoverProps {
  /** Current price value to display (0 = Free) */
  value?: number;

  /** Callback when price is applied */
  onApply: (price: number) => void;
  /** Number of selected items (for Apply button text) */
  selectedCount?: number;
  /** Total number of applicable items (shown when selectedCount is 0) */
  totalCount?: number;
  /** Whether the popover is disabled */
  disabled?: boolean;
}

/**
 * PriceEditPopover - Pill-style button with NumberInput popover
 *
 * Shows as a clickable pill that opens a popover with focus-trapped NumberInput.
 * Used for bulk editing prices on selected upload items.
 *
 * @example
 * ```tsx
 * <PriceEditPopover
 *   value={0}
 *   onApply={(price) => handleBulkPriceEdit(selectedIds, price)}
 * />
 * ```
 */
export const PriceEditPopover: FC<PriceEditPopoverProps> = ({
  value = 0,
  onApply,
  selectedCount = 0,
  totalCount = 0,
  disabled = false,
}) => {
  const [opened, setOpened] = useState(false);
  const [draftPrice, setDraftPrice] = useState<number>(value);
  const focusTrapRef = useFocusTrap(opened);

  const displayPrice = value === 0 ? 'Free' : `$${value.toFixed(2)}`;

  const footerMessage = useMemo(() => {
    if (selectedCount > 0) {
      const itemText = selectedCount === 1 ? 'item' : 'items';
      return `Applying to ${selectedCount} ${itemText}`;
    }
    if (totalCount > 0) {
      return 'Applying to all items';
    }
    return null;
  }, [selectedCount, totalCount]);

  useEffect(() => {
    if (opened) {
      setDraftPrice(value);
    }
  }, [opened, value]);

  const handleApply = () => {
    onApply(draftPrice);
    setOpened(false);
  };

  const handleCancel = () => {
    setDraftPrice(value);
    setOpened(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleApply();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  return (
    <Popover
      opened={opened}
      onChange={setOpened}
      position="bottom"
      withArrow
      shadow="md"
    >
      <Popover.Target>
        <Button
          variant="light"
          color="green"
          leftSection={<IconCurrencyDollar size={16} />}
          rightSection={<IconChevronDown size={14} />}
          disabled={disabled}
          onClick={() => setOpened((o) => !o)}
          styles={{
            root: {
              borderRadius: '20px',
              paddingLeft: '12px',
              paddingRight: '12px',
            },
          }}
        >
          {displayPrice}
        </Button>
      </Popover.Target>

      <Popover.Dropdown>
        <Stack gap="sm" ref={focusTrapRef}>
          <NumberInput
            label="Price"
            placeholder="Enter price"
            value={draftPrice}
            onChange={(val) => setDraftPrice(typeof val === 'number' ? val : 0)}
            onKeyDown={handleKeyDown}
            min={0}
            step={0.01}
            decimalScale={2}
            fixedDecimalScale
            prefix="$"
            autoFocus
          />

          {footerMessage && (
            <Box p="xs" bg="green.0" style={{ borderRadius: '4px' }}>
              <Text size="sm" c="dimmed" ta="center">
                {footerMessage}
              </Text>
            </Box>
          )}

          <Group gap="xs" grow>
            <Button onClick={handleApply}>
              Apply
            </Button>
            <Button variant="subtle" onClick={handleCancel}>
              Cancel
            </Button>
          </Group>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
};

export default PriceEditPopover;
