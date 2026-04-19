import { Alert, Button, Group, Stack, Text } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import type { Spot } from 'entities/Spot/types';

interface ProximityStepProps {
  nearbySpots: Spot[];
  isCreating: boolean;
  onGoToExisting: (spot: Spot) => void;
  onConfirmCreate: () => void;
  onBack: () => void;
  onCancel: () => void;
}

export function ProximityStep({
  nearbySpots,
  isCreating,
  onGoToExisting,
  onConfirmCreate,
  onBack,
  onCancel,
}: ProximityStepProps) {
  return (
    <Stack gap="sm">
      <Alert
        icon={<IconAlertTriangle size={16} />}
        color="yellow"
        title="Nearby spot found"
        p="xs"
      >
        There's already a spot within 300 m. Is this the one you meant?
      </Alert>

      {nearbySpots.map((spot) => (
        <Group
          key={spot.id}
          justify="space-between"
          p="xs"
          bd="1px solid var(--mantine-color-dark-4)" style={{ borderRadius: 8 }}
        >
          <Stack gap={2}>
            <Text size="sm" fw={500}>{spot.name}</Text>
            <Text size="xs" c="dimmed">{spot.location}</Text>
          </Stack>
          <Button size="xs" onClick={() => onGoToExisting(spot)}>
            Go to this spot
          </Button>
        </Group>
      ))}

      <Group justify="space-between" mt="xs">
        <Group gap="xs">
          <Button variant="default" size="xs" onClick={onBack}>← Back</Button>
          <Button variant="default" size="xs" onClick={onCancel}>Cancel</Button>
        </Group>
        <Button
          size="xs"
          variant="subtle"
          color="gray"
          onClick={onConfirmCreate}
          loading={isCreating}
        >
          No, create new →
        </Button>
      </Group>
    </Stack>
  );
}
