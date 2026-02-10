'use client';

import { useState } from 'react';
import { Popover, NumberInput, Button, Group, Stack } from '@mantine/core';
import { IconCurrencyDollar } from '@tabler/icons-react';

interface PriceEditPopoverProps {
  value?: number;
  onApply: (price: number) => void;
}

export function PriceEditPopover({ value, onApply }: PriceEditPopoverProps) {
  const [opened, setOpened] = useState(false);
  const [inputValue, setInputValue] = useState<number>(value || 0);

  const handleApply = () => {
    onApply(inputValue);
    setOpened(false);
  };

  const displayValue = value && value > 0 ? `$${value.toFixed(2)}` : 'Free';

  return (
    <Popover
      opened={opened}
      onChange={setOpened}
      trapFocus
      position="bottom-start"
      withArrow
      shadow="md"
    >
      <Popover.Target>
        <Button
          variant="light"
          size="compact-sm"
          leftSection={<IconCurrencyDollar size={14} />}
          style={{ cursor: 'pointer' }}
          onClick={() => setOpened((o) => !o)}
        >
          {displayValue}
        </Button>
      </Popover.Target>

      <Popover.Dropdown>
        <Stack gap="sm">
          <NumberInput
            label="Price"
            placeholder="0.00"
            value={inputValue}
            onChange={(val) => setInputValue(Number(val) || 0)}
            min={0}
            max={999999}
            decimalScale={2}
            fixedDecimalScale
            prefix="$"
            allowNegative={false}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleApply();
              }
            }}
          />
          <Group gap="xs" justify="flex-end">
            <Button variant="subtle" size="xs" onClick={() => setOpened(false)}>
              Cancel
            </Button>
            <Button variant="filled" size="xs" onClick={handleApply}>
              Apply
            </Button>
          </Group>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}
