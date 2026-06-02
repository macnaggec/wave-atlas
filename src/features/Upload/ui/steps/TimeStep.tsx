import React, { useState, useCallback, useMemo } from 'react';
import { Center, RangeSlider, Stack, Text } from '@mantine/core';
import { DatePicker } from '@mantine/dates';
import { useUploadStore } from 'features/Upload/model/uploadStore';
import type { Spot } from 'entities/Spot/types';
import { minutesToTime } from './helpers';

function dateToMinutes(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

interface TimeStepProps {
  spot: Spot;
  onChange: (date: Date | null, range: [number, number]) => void;
}

export function TimeStep({ spot, onChange }: TimeStepProps) {
  const queue = useUploadStore((s) => s.uploadQueue);
  const exifDates = useMemo(() => {
    return queue
      .filter((item) => item.spotId === spot.id && item.status === 'completed' && item.capturedAt)
      .map((item) => item.capturedAt!);
  }, [queue, spot.id]);

  const [date, setDate] = useState<Date | null>(() => {
    if (exifDates.length === 0) return new Date();
    return new Date(Math.min(...exifDates.map((d) => d.getTime())));
  });

  const [isDragging, setIsDragging] = useState(false);
  const [range, setRange] = useState<[number, number]>(() => {
    if (exifDates.length === 0) return [360, 600];
    const start = Math.min(...exifDates.map(dateToMinutes));
    const end = Math.max(...exifDates.map(dateToMinutes));
    return [start, Math.max(start + 15, end)];
  });

  const handleDateChange = useCallback((val: Date | string | null) => {
    const newDate = !val ? null : typeof val === 'string' ? new Date(val) : val;
    setDate(newDate);
    onChange(newDate, range);
  }, [range, onChange]);

  const handleRangeChange = useCallback((newRange: [number, number]) => {
    setIsDragging(true);
    setRange(newRange);
    onChange(date, newRange);
  }, [date, onChange]);

  return (
    <Stack gap={0} p="md">
      <Text size="sm" fw={500} ta="center" mb="lg" style={{ letterSpacing: '0.07em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)' }}>When did you shoot?</Text>

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
            onChangeEnd={() => setIsDragging(false)}
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
