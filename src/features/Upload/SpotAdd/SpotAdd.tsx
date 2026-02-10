'use client'

import { Button, Group, Stack, TextInput } from '@mantine/core';
import { useState } from 'react';
import dynamic from 'next/dynamic';

import { LngLat, fromMapboxCoords } from 'shared/types/coordinates';

// Dynamic import for LocationPicker to avoid SSR issues with Mapbox
const DynamicLocationPicker = dynamic(
    () => import('widgets/GlobeMap/LocationPicker').then(mod => mod.LocationPicker),
    { ssr: false }
);

export interface SpotAddProps {
    spotName: string;
    onSave: (data: { name: string, coords: [number, number] }) => void;
}

const SpotAdd = ({
    spotName,
    onSave,
}: SpotAddProps) => {
    const [position, setPosition] = useState<LngLat | null>(null);
    const [name, setName] = useState(spotName);
    const [error, setError] = useState<string | null>(null);

    const validateName = (value: string) => {
        if (value.trim().length < 2) {
            setError('Value is too short');
            return false;
        }
        setError(null);
        return true;
    };

    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setName(e.target.value);
    };

    const handleNameBlur = () => {
        validateName(name);
    };

    const handleSave = () => {
        if (position && validateName(name)) {
            // Convert [lng, lat] to [lat, lng] for backend compatibility
            onSave({
                coords: fromMapboxCoords(position),
                name: name
            });
        }
    };

    return (
        <Group wrap={'nowrap'} align={'stretch'}>
            <Stack align={'stretch'} justify={'space-between'}>
                <TextInput
                    value={name}
                    onChange={handleNameChange}
                    onBlur={handleNameBlur}
                    error={error}
                    label="Spot name"
                    description="Specify commonly used name of the spot"
                    placeholder="Spot name"
                />

                <Button
                    radius={'xl'}
                    disabled={!position || !!error}
                    onClick={handleSave}
                >
                    Save
                </Button>
            </Stack>

            <div style={{ height: '500px', width: '100%' }}>
                <DynamicLocationPicker
                    position={position}
                    onPositionChange={setPosition}
                />
            </div>
        </Group>
    );
}

export default SpotAdd;
