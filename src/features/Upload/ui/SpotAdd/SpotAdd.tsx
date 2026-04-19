import { Button, Group, Stack, TextInput } from '@mantine/core';
import { Suspense, lazy, useState } from 'react';

import { LngLat, fromMapboxCoords } from 'shared/types/coordinates';
import { spotNameSchema } from 'shared/validation/spotSchemas';

const DynamicLocationPicker = lazy(
    () => import('widgets/GlobeMap/LocationPicker').then(mod => ({ default: mod.LocationPicker }))
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
        const result = spotNameSchema.safeParse(value.trim());
        if (!result.success) {
            setError(result.error.issues[0].message);
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
                <Suspense fallback={null}>
                    <DynamicLocationPicker
                        position={position}
                        onPositionChange={setPosition}
                    />
                </Suspense>
            </div>
        </Group>
    );
}

export default SpotAdd;
