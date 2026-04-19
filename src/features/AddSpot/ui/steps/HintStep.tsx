import { Button, Group, Stack, Text } from '@mantine/core';
import { IconMapPin } from '@tabler/icons-react';

interface HintStepProps {
  onCancel: () => void;
}

export function HintStep({ onCancel }: HintStepProps) {
  return (
    <Stack gap="sm">
      <Group gap="xs">
        <IconMapPin size={18} />
        <Text fw={500}>Click the globe to place a pin</Text>
      </Group>

      <Text size="sm" c="dimmed">
        Drop a pin exactly where the surf spot is located.
      </Text>

      <Group justify="flex-end">
        <Button variant="default" size="xs" onClick={onCancel}>Cancel</Button>
      </Group>
    </Stack>
  );
}
