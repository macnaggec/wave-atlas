'use client';

import { useState } from 'react';
import { Popover, Button, Group, Stack } from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import { IconCalendar } from '@tabler/icons-react';

interface DateEditPopoverProps {
  value?: Date;
  onApply: (date: Date) => void;
}

export function DateEditPopover({ value, onApply }: DateEditPopoverProps) {
  const [opened, setOpened] = useState(false);
  const [inputValue, setInputValue] = useState<Date | null>(value || new Date());

  const handleApply = () => {
    if (inputValue) {
      onApply(inputValue);
      setOpened(false);
    }
  };

  const handleDateChange = (val: Date | string | null) => {
    if (val) {
      const date = typeof val === 'string' ? new Date(val) : val;
      setInputValue(date);
    }
  };

  const displayValue = value
    ? new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(value)
    : 'Set Date';

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
          leftSection={<IconCalendar size={14} />}
          style={{ cursor: 'pointer' }}
          onClick={() => setOpened((o) => !o)}
        >
          {displayValue}
        </Button>
      </Popover.Target>

      <Popover.Dropdown>
        <Stack gap="sm">
          <DateTimePicker
            label="Capture Date"
            placeholder="Select date and time"
            value={inputValue}
            onChange={handleDateChange}
            clearable={false}
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
