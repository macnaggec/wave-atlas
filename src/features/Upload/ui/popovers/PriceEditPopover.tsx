import { FC, useEffect, useState } from 'react';
import { Popover, Button, Stack, NumberInput, Text, Box, Group, Tooltip } from '@mantine/core';
import { IconCurrencyDollar, IconChevronDown } from '@tabler/icons-react';
import { MIN_MEDIA_PRICE_CENTS } from 'entities/Media/constants';

const MIN_PRICE = MIN_MEDIA_PRICE_CENTS / 100;

/**
 * Props for PriceEditPopover component
 */
export interface PriceEditPopoverProps {
  /** Current price value to display in dollars */
  value?: number;

  /** Callback when price is applied */
  onApply: (price: number) => void;

  /** Number of selected items (for Apply button text) */
  selectedCount?: number;
  /** Total number of applicable items (shown when selectedCount is 0) */
  totalCount?: number;
  /** Whether the popover is disabled */
  disabled?: boolean;
  /** Tooltip text to show when disabled */
  tooltip?: string;
}

/**
 * PriceEditPopover - Pill-style button with NumberInput popover
 *
 * Shows as a clickable pill that opens a popover for bulk price editing.
 * Used in Upload feature for editing prices on selected draft items.
 */
export const PriceEditPopover: FC<PriceEditPopoverProps> = ({
  value = 0,
  onApply,
  selectedCount = 0,
  totalCount = 0,
  disabled = false,
  tooltip,
}) => {
  const [opened, setOpened] = useState(false);
  const [draftPrice, setDraftPrice] = useState<number | string>(value >= MIN_PRICE ? value : MIN_PRICE);

  const numericValue = typeof draftPrice === 'number'
    ? draftPrice
    : parseFloat(String(draftPrice));

  const canApply = !isNaN(numericValue) && numericValue >= MIN_PRICE;

  const priceError = draftPrice === ''
    ? 'Enter a price'
    : !isNaN(numericValue) && numericValue < MIN_PRICE
      ? `Minimum price is $${MIN_PRICE.toFixed(2)}`
      : null;

  const displayPrice = value > 0 ? `$${value.toFixed(2)}` : 'Set price';

  const footerMessage = selectedCount > 0
    ? `Applying to ${selectedCount} ${selectedCount === 1 ? 'item' : 'items'}`
    : 'Applying to all items';

  const footer = (selectedCount > 0 || totalCount > 0) ? (
    <Box p="xs" bg="green.0" style={{ borderRadius: '4px' }}>
      <Text size="sm" c="dimmed" ta="center">
        {footerMessage}
      </Text>
    </Box>
  ) : null;

  useEffect(() => {
    if (opened) {
      setDraftPrice(value >= MIN_PRICE ? value : MIN_PRICE);
    }
  }, [opened, value]);

  const handleApply = () => {
    if (!canApply) return;
    onApply(numericValue);
    setOpened(false);
  };

  const handleCancel = () => {
    setDraftPrice(value >= MIN_PRICE ? value : MIN_PRICE);
    setOpened(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleApply();
    else if (e.key === 'Escape') handleCancel();
  };

  const popover = (
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
          radius="xl"
          onClick={() => setOpened((o) => !o)}
        >
          {displayPrice}
        </Button>
      </Popover.Target>

      <Popover.Dropdown>
        <Stack gap="sm">
          <NumberInput
            label="Price"
            placeholder="Enter price"
            value={draftPrice}
            onChange={setDraftPrice}
            onKeyDown={handleKeyDown}
            min={MIN_PRICE}
            step={0.01}
            decimalScale={2}
            fixedDecimalScale
            prefix="$"
            autoFocus
            error={priceError}
          />

          {footer}

          <Group gap="xs" grow>
            <Button onClick={handleApply} disabled={!canApply}>
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

  if (disabled && tooltip) {
    return (
      <Tooltip label={tooltip} withinPortal>
        <Box>{popover}</Box>
      </Tooltip>
    );
  }

  return popover;
};

export default PriceEditPopover;
