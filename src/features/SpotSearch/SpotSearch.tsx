import { Combobox, Input, Loader, useCombobox, Text, Group, CloseButton, Divider } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { notifications } from '@mantine/notifications';
import { useState, useCallback, useDeferredValue } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTRPC } from 'app/lib/trpc';
import { Spot } from 'entities/Spot/types';
import { getErrorMessage } from 'shared/lib/getErrorMessage';
import { SpotResultOption } from './ui/SpotResultOption';

export interface SpotSearchProps {
  onSpotSelect: (spot: Spot) => void;
  /** Render prop: called with the current search term when no results are found. Caller owns all domain logic. */
  emptyAction?: (search: string) => ReactNode;
  placeholder?: string;
}

export default function SpotSearch({
  onSpotSelect,
  emptyAction,
  placeholder = "Search for a spot..."
}: SpotSearchProps) {
  const trpc = useTRPC();
  const [search, setSearch] = useState('');
  const combobox = useCombobox();

  // useDeferredValue defers the query key update so typing feels instant
  // while the fetch happens in the background — no manual debounce needed.
  const deferredSearch = useDeferredValue(search);
  const isQueryEnabled = deferredSearch.length >= 2;

  const { data: spots = null, isFetching } = useQuery({
    ...trpc.spots.list.queryOptions(deferredSearch),
    enabled: isQueryEnabled,
  });

  const handleAliasError = useCallback((error: unknown) => {
    notifications.show({
      title: 'Failed to save alias',
      message: getErrorMessage(error) || 'Unable to save alias. Please try again.',
      color: 'red',
    });
  }, []);

  const handleSelect = useCallback((spotId: string) => {
    const spot = (spots ?? []).find(s => s.id === spotId);
    if (spot) {
      onSpotSelect(spot);
      setSearch(spot.name);
      combobox.closeDropdown();
    }
  }, [spots, onSpotSelect, combobox]);

  const handleClear = useCallback(() => {
    setSearch('');
    combobox.closeDropdown();
  }, [combobox]);

  const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.currentTarget.value;
    setSearch(value);
    if (value.length >= 2) {
      combobox.openDropdown();
    } else {
      combobox.closeDropdown();
    }
  }, [combobox]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && search.length >= 2) {
      event.preventDefault();
      combobox.openDropdown();
    }
  }, [search, combobox]);

  const handleClearClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handleClear();
  }, [handleClear]);

  const hasFetched = isQueryEnabled && !isFetching && spots !== null;
  const options = (spots ?? []).map((spot) => (
    <SpotResultOption key={spot.id} spot={spot} onAliasError={handleAliasError} />
  ));

  const renderRightSection = () => {
    if (isFetching) return <Loader size={16} />;
    if (search) return <CloseButton size="sm" onClick={handleClearClick} aria-label="Clear search" />;
    return null;
  };

  const renderDropdownContent = () => {
    if (options.length > 0) return options;
    if (search.length < 2) return <Combobox.Empty>Type at least 2 characters</Combobox.Empty>;
    if (!hasFetched) return <Combobox.Empty>No spots found</Combobox.Empty>;
    return (
      <div>
        <Combobox.Empty>No spots found for "{search}"</Combobox.Empty>
        {emptyAction && (
          <>
            <Divider />
            <Group p="xs" justify="center">
              {emptyAction(search)}
            </Group>
          </>
        )}
      </div>
    );
  };

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
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          leftSection={<IconSearch size={16} />}
          rightSection={renderRightSection()}
          rightSectionPointerEvents="auto"
        />
      </Combobox.Target>

      <Combobox.Dropdown>
        <Combobox.Options>
          {renderDropdownContent()}
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  );
}

