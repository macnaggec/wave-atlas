'use client';

import { Combobox, Input, Loader, useCombobox, Text, Group, CloseButton } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import { useDebouncedCallback } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { useState } from 'react';
import { getSpots } from 'app/actions/spot';
import { Spot } from 'entities/Spot/types';
import { getErrorMessage } from 'shared/lib/getErrorMessage';

export interface SpotSearchProps {
  onSpotSelect: (spot: Spot) => void;
  placeholder?: string;
}

export default function SpotSearch({
  onSpotSelect,
  placeholder = "Search for a spot..."
}: SpotSearchProps) {
  const [search, setSearch] = useState('');
  const [spots, setSpots] = useState<Spot[]>([]);
  const [loading, setLoading] = useState(false);
  const combobox = useCombobox();

  const performSearch = async (query: string) => {
    setLoading(true);
    try {
      const results = await getSpots(query);
      setSpots(results);
      combobox.openDropdown();
    } catch (error: unknown) {
      setSpots([]);
      notifications.show({
        title: 'Search Failed',
        message: getErrorMessage(error) || 'Unable to search spots. Please try again.',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = useDebouncedCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setSpots([]);
      return;
    }

    await performSearch(query);
  }, 300);

  const handleSelect = (spotId: string) => {
    const spot = spots.find(s => s.id === spotId);
    if (spot) {
      onSpotSelect(spot);
      setSearch(spot.name);
      combobox.closeDropdown();
    }
  };

  const handleKeyDown = async (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && search.length >= 2) {
      event.preventDefault();
      // Trigger immediate search (bypass debounce) and show results in dropdown
      await performSearch(search);
    }
  };

  const handleClear = () => {
    setSearch('');
    setSpots([]);
    combobox.closeDropdown();
  };

  const options = spots.map((spot) => (
    <Combobox.Option value={spot.id} key={spot.id}>
      <Group gap="xs">
        <Text size="sm" fw={500}>{spot.name}</Text>
        <Text size="xs" c="dimmed">{spot.location}</Text>
      </Group>
    </Combobox.Option>
  ));

  return (
    <Combobox
      store={combobox}
      onOptionSubmit={handleSelect}
      withinPortal={false}
    >
      <Combobox.Target>
        <Input
          placeholder={placeholder}
          value={search}
          onChange={(event) => {
            const value = event.currentTarget.value;
            setSearch(value);
            handleSearch(value);
            if (!value) {
              setSpots([]);
              combobox.closeDropdown();
            }
          }}
          onKeyDown={handleKeyDown}
          leftSection={<IconSearch size={16} />}
          rightSection={
            loading ? (
              <Loader size={16} />
            ) : search ? (
              <CloseButton
                size="sm"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleClear();
                }}
                aria-label="Clear search"
              />
            ) : null
          }
          rightSectionPointerEvents="auto"
        />
      </Combobox.Target>

      <Combobox.Dropdown>
        <Combobox.Options>
          {options.length > 0 ? (
            options
          ) : (
            <Combobox.Empty>
              {search.length < 2 ? 'Type at least 2 characters' : 'No spots found'}
            </Combobox.Empty>
          )}
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  );
}
