import { useEffect, useCallback } from 'react';
import { ActionIcon, Divider, Group, Stack, Text } from '@mantine/core';
import { IconMapPin, IconX } from '@tabler/icons-react';
import { useMapStore } from 'widgets/GlobeMap/model/mapStore';
import type { Spot } from 'entities/Spot/types';
import SpotSelect from '../SpotSelect/SpotSelect';

interface SpotStepProps {
  spot: Spot | null;
  onSelect: (spot: Spot) => void;
  onClear: () => void;
}

export function SpotStep({ spot, onSelect, onClear }: SpotStepProps) {
  const { enterSpotSelect, exitSpotSelect, clearSelection, selectedSpot } = useMapStore();

  useEffect(() => {
    if (spot) {
      exitSpotSelect();
    } else {
      enterSpotSelect();
    }
  }, [spot, enterSpotSelect, exitSpotSelect]);

  useEffect(() => {
    return () => {
      exitSpotSelect();
      clearSelection();
    };
  }, [exitSpotSelect, clearSelection]);

  useEffect(() => {
    if (selectedSpot && !spot) {
      clearSelection();
      onSelect(selectedSpot);
    }
  }, [selectedSpot, spot, clearSelection, onSelect]);

  const handleSelect = useCallback((s: Spot) => {
    clearSelection();
    onSelect(s);
  }, [clearSelection, onSelect]);

  if (spot) {
    return (
      <>
        <Group px="md" py="xs" gap="xs" justify="space-between">
          <Group gap="xs">
            <IconMapPin size={14} style={{ color: 'rgba(255,255,255,0.65)' }} />
            <Text size="sm" fw={500} style={{ color: '#fff' }}>{spot.name} · {spot.location}</Text>
          </Group>
          <ActionIcon variant="subtle" size="sm" onClick={onClear} aria-label="Clear spot">
            <IconX size={13} />
          </ActionIcon>
        </Group>
        <Divider />
      </>
    );
  }

  return (
    <Stack gap="xs" p="md">
      <Text size="sm" fw={500} style={{ color: '#fff' }}>Select a surf spot</Text>
      <SpotSelect onSelect={handleSelect} />
      <Text size="xs" style={{ color: 'rgba(255,255,255,0.65)', textAlign: 'center' }}>
        or click a spot on the map
      </Text>
    </Stack>
  );
}
