import type { ReactNode } from 'react';
import { Group, Text, Divider } from '@mantine/core';

export function StepPill({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <>
      <Group px="md" py="xs" gap="xs">
        {icon}
        <Text size="sm" fw={500} style={{ color: '#fff' }}>{label}</Text>
      </Group>
      <Divider />
    </>
  );
}

export function combineDateAndTime(date: Date, timeStr: string): Date {
  const [h, m] = timeStr.split(':').map(Number);
  const result = new Date(date);
  result.setHours(h || 0, m || 0, 0, 0);
  return result;
}
