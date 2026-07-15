import { Button, Group, Loader, Stack, TextInput } from '@mantine/core';

interface FormStepProps {
  name: string;
  location: string;
  nameError: string | null;
  locationError: string | null;
  isGeocoding: boolean;
  isSubmitting: boolean;
  onNameChange: (v: string) => void;
  onLocationChange: (v: string) => void;
  onBack: () => void;
  onCancel: () => void;
  onSubmit: () => void;
}

export function FormStep({
  name,
  location,
  nameError,
  locationError,
  isGeocoding,
  isSubmitting,
  onNameChange,
  onLocationChange,
  onBack,
  onCancel,
  onSubmit,
}: FormStepProps) {
  return (
    <Stack gap={6}>
      <TextInput
        label="Spot name"
        placeholder="e.g. Uluwatu"
        value={name}
        onChange={(e) => onNameChange(e.currentTarget.value)}
        error={nameError}
        required
        autoFocus
        size="xs"
      />
      <TextInput
        label="Location"
        placeholder="e.g. Bali, Indonesia"
        value={location}
        onChange={(e) => onLocationChange(e.currentTarget.value)}
        error={locationError}
        required
        rightSection={isGeocoding ? <Loader size={14} /> : null}
        size="xs"
      />
      <Group justify="space-between" mt={2}>
        <Group gap="xs">
          <Button variant="default" size="xs" onClick={onBack}>Back</Button>
          <Button variant="default" size="xs" onClick={onCancel}>Cancel</Button>
        </Group>
        <Button
          size="xs"
          onClick={onSubmit}
          loading={isSubmitting}
          disabled={!name.trim() || !location.trim()}
        >
          Add
        </Button>
      </Group>
    </Stack>
  );
}
