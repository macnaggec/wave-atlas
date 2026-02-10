'use client';

import { Combobox, Input, Loader, useCombobox, Text, Group } from '@mantine/core';
import { useDebouncedCallback } from '@mantine/hooks';
import { notify } from 'shared/lib/notifications';
import { useState } from 'react';
import { getSpots } from 'app/actions/spot';
import { Spot } from 'entities/Spot/types';
import { getErrorMessage } from 'shared/lib/getErrorMessage';

export interface SpotSelectProps {
    onSelect: (spot: Spot) => void;
    selectedSpot?: Spot | null;
}

export default function SpotSelect({ onSelect, selectedSpot }: SpotSelectProps) {
    const [search, setSearch] = useState('');
    const [data, setData] = useState<Spot[]>([]);
    const [loading, setLoading] = useState(false);
    const combobox = useCombobox();

    const handleSearch = useDebouncedCallback(async (query: string) => {
        if (!query) return;
        setLoading(true);
        try {
            const spots = await getSpots(query);
            setData(spots);
        } catch (error: unknown) {
            setData([]);
            notify.error(getErrorMessage(error), 'Search Failed');
        } finally {
            setLoading(false);
        }
    }, 300);

    const options = data.map((item) => (
        <Combobox.Option value={item.id} key={item.id}>
            <Group gap="xs">
                <Text size="sm" fw={500}>{item.name}</Text>
                <Text size="xs" c="dimmed">{item.location}</Text>
            </Group>
        </Combobox.Option>
    ));

    return (
        <Combobox
            store={combobox}
            onOptionSubmit={(val) => {
                const spot = data.find(s => s.id === val);
                if (spot) {
                    onSelect(spot);
                    setSearch('');
                    combobox.closeDropdown();
                }
            }}
        >
            <Combobox.Target>
                <Input
                    placeholder={selectedSpot ? `${selectedSpot.name} (${selectedSpot.location})` : "Search for a spot..."}
                    value={search}
                    onChange={(event) => {
                        setSearch(event.currentTarget.value);
                        handleSearch(event.currentTarget.value);
                        combobox.openDropdown();
                    }}
                    rightSection={loading && <Loader size={18} />}
                />
            </Combobox.Target>

            <Combobox.Dropdown>
                <Combobox.Options>
                    {options.length > 0 ? options : <Combobox.Empty>No spots found</Combobox.Empty>}
                </Combobox.Options>
            </Combobox.Dropdown>
        </Combobox>
    );
}
