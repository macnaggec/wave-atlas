'use client';

import { useState } from 'react';
import { Modal, Stack, NumberInput, Button, Group } from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import { IconCurrencyDollar, IconCalendar } from '@tabler/icons-react';

/**
 * MetadataForm - Edit price and capture date for media items
 *
 * Features:
 * - Price input with USD currency formatting
 * - Date/time picker pre-filled with EXIF data or fallback
 * - Clear validation feedback
 * - Support for single and bulk editing
 *
 * Design decisions:
 * - Uses Mantine DateTimePicker (not native HTML5) for consistency
 * - Price allows $0 for "Free" content
 * - Date is required - shows warning if overwriting EXIF data
 */

interface MetadataFormProps {
  /** Whether modal is open */
  opened: boolean;
  /** Close modal handler */
  onClose: () => void;
  /** Initial price value (defaults to 0 for "Free") */
  initialPrice?: number;
  /** Initial date value (from EXIF or fallback) */
  initialDate?: Date;
  /** Whether this date came from EXIF metadata */
  isDateFromExif?: boolean;
  /** Number of items being edited (1 for single, N for bulk) */
  itemCount?: number;
  /** Submit handler - receives updated values */
  onSubmit: (data: { price: number; capturedAt: Date }) => void;
}

export function MetadataForm({
  opened,
  onClose,
  initialPrice = 0,
  initialDate = new Date(),
  isDateFromExif = false,
  itemCount = 1,
  onSubmit,
}: MetadataFormProps) {
  // Local form state
  const [price, setPrice] = useState<number>(initialPrice);
  const [capturedAt, setCapturedAt] = useState<Date>(initialDate);

  const handleSubmit = () => {
    // TODO: Add validation (date required, price >= 0)
    onSubmit({ price, capturedAt });
    onClose();
  };

  const handleCancel = () => {
    // Reset to initial values on cancel
    setPrice(initialPrice);
    setCapturedAt(initialDate);
    onClose();
  };

  // Modal title based on single vs bulk edit
  const title = itemCount > 1
    ? `Edit ${itemCount} Items`
    : 'Edit Metadata';

  return (
    <Modal
      opened={opened}
      onClose={handleCancel}
      title={title}
      centered
      size="md"
    >
      <Stack gap="md">
        {/* Price Input */}
        <NumberInput
          label="Price"
          description="Set to $0 for free content"
          placeholder="0.00"
          value={price}
          onChange={(val) => setPrice(Number(val) || 0)}
          min={0}
          max={999999}
          decimalScale={2}
          fixedDecimalScale
          prefix="$"
          leftSection={<IconCurrencyDollar size={16} />}
          allowNegative={false}
        />

        {/* Date/Time Picker */}
        <DateTimePicker
          label="Capture Date & Time"
          description={
            isDateFromExif
              ? "Auto-detected from EXIF metadata"
              : "Set manually (no EXIF data found)"
          }
          placeholder="Select date and time"
          value={capturedAt}
          onChange={(val: string | Date | null) => {
            if (val) {
              const date = typeof val === 'string' ? new Date(val) : val;
              setCapturedAt(date);
            }
          }}
          leftSection={<IconCalendar size={16} />}
          clearable={false}
          required
        />

        {/* TODO: Add warning when overwriting EXIF date */}

        {/* Action Buttons */}
        <Group justify="flex-end" gap="sm">
          <Button variant="subtle" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>
            {itemCount > 1 ? `Apply to ${itemCount} Items` : 'Save'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
