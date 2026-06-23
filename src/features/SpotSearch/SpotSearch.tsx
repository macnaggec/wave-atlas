import { Combobox, Input, Loader, useCombobox, Group, CloseButton, Divider } from '@mantine/core';
import classes from './SpotSearch.module.css';
import { IconSearch, IconMapPin } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { notifications } from '@mantine/notifications';
import { useState, useCallback, useDeferredValue } from 'react';
import { useSpots, Spot } from 'entities/Spot';
import { getErrorMessage } from 'shared/lib/getErrorMessage';
import { SpotResultOption } from './ui/SpotResultOption';

export interface SpotSearchProps {
  onSpotSelect: (spot: Spot) => void;
  /** Render prop: called with the current search term when no results are found. Caller owns all domain logic. */
  emptyAction?: (search: string) => ReactNode;
  placeholder?: string;
  /** Called when the active spot filter is cleared (✕ click or typing after a selection). */
  onClear?: () => void;
  /** When set, drives the search input and filtering state as if the spot had been selected via search. */
  activeSpot?: Pick<Spot, 'id' | 'name' | 'location'> | null;
  autoFocus?: boolean;
}

export default function SpotSearch({
  onSpotSelect,
  emptyAction,
  placeholder = "Search for a spot...",
  onClear,
  activeSpot,
  autoFocus,
}: SpotSearchProps) {
  const [search, setSearch] = useState('');

  const isFiltering = activeSpot != null;
  const inputValue = activeSpot ? activeSpot.name : search;

  const combobox = useCombobox();

  // useDeferredValue defers the query key update so typing feels instant
  // while the fetch happens in the background — no manual debounce needed.
  const deferredSearch = useDeferredValue(search);
  const isQueryEnabled = deferredSearch.length >= 2;

  const { data: spots = null, isFetching } = useSpots(deferredSearch, { enabled: isQueryEnabled });

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
      combobox.closeDropdown();
    }
  }, [spots, onSpotSelect, combobox]);

  const handleClear = useCallback(() => {
    setSearch('');
    combobox.closeDropdown();
  }, [combobox]);

  const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.currentTarget.value;
    // Only clear the active spot when the user actually edits away from it.
    // Guards against synthetic change events fired by closeDropdown() which
    // carry the stale local `search` value while activeSpot is already set.
    if (activeSpot && value !== activeSpot.name) {
      onClear?.();
    }
    setSearch(value);
    if (value.length >= 2) {
      combobox.openDropdown();
    } else {
      combobox.closeDropdown();
    }
  }, [activeSpot, onClear, combobox]);

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
    onClear?.();
  }, [handleClear, onClear]);

  const hasFetched = isQueryEnabled && !isFetching && spots !== null;
  const options = (spots ?? []).map((spot) => (
    <SpotResultOption key={spot.id} spot={spot} onAliasError={handleAliasError} />
  ));

  const renderRightSection = () => {
    if (isFetching) return <Loader size={16} />;
    if (inputValue) return <CloseButton size="sm" onClick={handleClearClick} aria-label="Clear search" radius="xl" className={classes.clearButton} />;
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
          value={inputValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          autoFocus={autoFocus}
          radius="md"
          leftSection={
            isFiltering
              ? <IconMapPin size={16} color="#63b3ed" />
              : <IconSearch size={16} />
          }
          rightSection={renderRightSection()}
          rightSectionPointerEvents="auto"
          styles={{
            input: {
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.14)',
              color: '#fff',
              boxShadow: isFiltering ? 'inset 3px 0 0 #63b3ed' : 'none',
              caretColor: isFiltering ? 'transparent' : undefined,
              cursor: isFiltering ? 'default' : undefined,
              '&::placeholder': { color: 'rgba(255,255,255,0.38)' },
              '&:focus': { borderColor: 'rgba(255,255,255,0.4)' },
            },
            section: { color: 'rgba(255,255,255,0.55)' },
          }}
        />
      </Combobox.Target>

      <Combobox.Dropdown
        style={{
          background: 'rgba(13,22,42,0.97)',
          backdropFilter: 'blur(12px) saturate(140%)',
          WebkitBackdropFilter: 'blur(12px) saturate(140%)',
          border: '1px solid rgba(255,255,255,0.14)',
          borderRadius: 8,
          boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
          '--mantine-color-dimmed': 'rgba(255,255,255,0.4)',
          '--mantine-color-text': 'rgba(255,255,255,0.85)',
          '--mantine-color-gray-0': 'rgba(255,255,255,0.06)',
          '--mantine-color-gray-2': 'rgba(255,255,255,0.08)',
        } as React.CSSProperties}
      >
        <Combobox.Options>
          {renderDropdownContent()}
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  );
}
