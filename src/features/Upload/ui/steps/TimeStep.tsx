import React, { useState, useCallback } from 'react';
import { Center, RangeSlider, Stack, Text } from '@mantine/core';
import { DatePicker } from '@mantine/dates';
import { minutesToTime } from './helpers';

interface TimeStepProps {
  date: Date | null;
  range: [number, number];
  onChange: (date: Date | null, range: [number, number]) => void;
  onCommit: (date: Date | null, range: [number, number]) => void;
  hasTriedPublish?: boolean;
}

export function TimeStep({ date, range, onChange, onCommit, hasTriedPublish }: TimeStepProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDateChange = useCallback((val: Date | string | null) => {
    const newDate = !val ? null : typeof val === 'string' ? new Date(val) : val;
    onChange(newDate, range);
    onCommit(newDate, range);
  }, [range, onChange, onCommit]);

  const handleRangeChange = useCallback((newRange: [number, number]) => {
    setIsDragging(true);
    onChange(date, newRange);
  }, [date, onChange]);

  const dateError = hasTriedPublish && !date;

  return (
    <Stack gap={0} p="md">
      <Text size="sm" fw={500} ta="center" mb="lg" style={{ letterSpacing: '0.07em', textTransform: 'uppercase', color: dateError ? 'var(--mantine-color-red-5)' : 'rgba(255,255,255,0.4)' }}>When did you shoot?</Text>

      <Stack gap={'40px'}>
        <Center>
          <DatePicker
            value={date}
            onChange={handleDateChange}
            maxDate={new Date()}
            size="sm"
            styles={{
              calendarHeader: { color: '#fff' },
              calendarHeaderLevel: { color: '#fff', background: 'transparent' },
              calendarHeaderControl: { color: 'rgba(255,255,255,0.65)' },
              weekday: { color: 'rgba(255,255,255,0.5)' },
              day: { color: '#fff' },
            }}
          />
        </Center>

        <Stack gap={6}>
          <Text
            ta="center"
            style={{
              lineHeight: '22px',
              color: isDragging ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.65)',
              fontSize: isDragging ? 15 : 12,
              fontWeight: isDragging ? 600 : 400,
              transition: 'all 120ms ease',
            }}
          >
            {minutesToTime(range[0])} – {minutesToTime(range[1])}
          </Text>
          <RangeSlider
            value={range}
            onChange={handleRangeChange}
            onChangeEnd={(newRange) => {
              setIsDragging(false);
              onCommit(date, newRange);
            }}
            min={0}
            max={1440}
            step={15}
            minRange={15}
            label={null}
            size="xs"
            styles={{
              root: {
                '--slider-radius': '2px',
                '--slider-track-bg': 'rgba(255,255,255,0.08)',
                '--slider-color': 'rgba(255,255,255,0.28)',
              } as React.CSSProperties,
              thumb: {
                border: 'none',
                width: 22,
                height: 10,
                borderRadius: 99,
                backgroundColor: 'rgba(255,255,255,0.88)',
                boxShadow: '0 1px 4px rgba(0,0,0,0.35)',
              },
            }}
          />
        </Stack>
      </Stack>
    </Stack>
  );
}
