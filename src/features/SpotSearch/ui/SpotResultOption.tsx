import { Combobox, Text, Group, TextInput, ActionIcon } from '@mantine/core';
import { IconCheck, IconX } from '@tabler/icons-react';
import { useState, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTRPC } from 'app/lib/trpc';
import { Spot } from 'entities/Spot/types';
import { spotAliasSchema } from 'shared/validation/spotSchemas';
import classes from './SpotResultOption.module.css';

interface SpotResultOptionProps {
  spot: Spot;
  onAliasError: (error: unknown) => void;
}

export function SpotResultOption({ spot, onAliasError }: SpotResultOptionProps) {
  const trpc = useTRPC();
  const [aliasOpen, setAliasOpen] = useState(false);
  const [aliasValue, setAliasValue] = useState('');
  const [aliasError, setAliasError] = useState<string | null>(null);

  const aliasMutation = useMutation({
    ...trpc.spots.addAlias.mutationOptions(),
    onSuccess: () => {
      setAliasValue('');
      setAliasOpen(false);
    },
    onError: onAliasError,
  });

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const trimmed = aliasValue.trim();
    const result = spotAliasSchema.safeParse(trimmed);
    if (!result.success) {
      setAliasError(result.error.issues[0].message);
      return;
    }
    await aliasMutation.mutateAsync({ spotId: spot.id, alias: trimmed });
  };

  const handleCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    setAliasValue('');
    setAliasError(null);
    setAliasOpen(false);
  };

  const handleOpenAlias = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setAliasOpen(true);
  }, []);

  const handleGroupClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  const handleAliasChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setAliasValue(e.currentTarget.value);
    setAliasError(null);
  }, []);

  const handleAliasKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') void handleSave(e as unknown as React.MouseEvent);
  }, [handleSave]);

  return (
    <Combobox.Option value={spot.id}>
      <Group gap="xs" justify="space-between" wrap="nowrap">
        <Group gap="xs">
          <Text size="sm" fw={500}>{spot.name}</Text>
          <Text size="xs" c="dimmed">{spot.location}</Text>
        </Group>
        {!aliasOpen && (
          <Text size="xs" c="blue" className={classes.aliasLink} onClick={handleOpenAlias}>
            Known by another name?
          </Text>
        )}
      </Group>

      {aliasOpen && (
        <Group gap="xs" mt={6} onClick={handleGroupClick}>
          <TextInput
            size="xs"
            placeholder={`Local name for "${spot.name}"`}
            value={aliasValue}
            onChange={handleAliasChange}
            onKeyDown={handleAliasKeyDown}
            error={aliasError}
            autoFocus
            className={classes.aliasInput}
          />
          <ActionIcon
            size="sm"
            variant="filled"
            color="blue"
            loading={aliasMutation.isPending}
            disabled={!aliasValue.trim()}
            onClick={(e) => void handleSave(e)}
            aria-label="Save alias"
          >
            <IconCheck size={12} />
          </ActionIcon>
          <ActionIcon size="sm" variant="default" onClick={handleCancel} aria-label="Cancel">
            <IconX size={12} />
          </ActionIcon>
        </Group>
      )}
    </Combobox.Option>
  );
}
