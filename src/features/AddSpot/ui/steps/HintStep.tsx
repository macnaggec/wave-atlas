import { Button, Group, Stack, Text } from '@mantine/core';
import { IconMapPin } from '@tabler/icons-react';
import styles from '../AddSpotPanel.module.css';

interface HintStepProps {
  onCancel: () => void;
}

export function HintStep({ onCancel }: HintStepProps) {
  return (
    <Stack gap={6}>
      <Group gap="xs" wrap="nowrap">
        <IconMapPin size={18} className={styles.hintIcon} />
        <Text fw={600} className={styles.hintTitle}>Click the globe to place a pin</Text>
      </Group>

      <Text size="sm" className={styles.hintCopy}>
        Drop a pin exactly where the surf spot is located.
      </Text>

      <Group justify="flex-end" mt={2}>
        <Button variant="default" size="xs" onClick={onCancel}>Cancel</Button>
      </Group>
    </Stack>
  );
}
