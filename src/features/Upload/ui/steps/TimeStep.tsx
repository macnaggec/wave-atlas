import { useState, useCallback, useMemo } from 'react';
import { Button, RangeSlider, Stack, Text } from '@mantine/core';
import { DatePicker } from '@mantine/dates';
import { useMutation } from '@tanstack/react-query';
import { useTRPC } from 'app/lib/trpc';
import { useUploadStore } from 'features/Upload/model/uploadStore';
import type { Spot } from 'entities/Spot/types';
import { combineDateAndTime } from './helpers';

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60).toString().padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

function dateToMinutes(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

interface TimeStepProps {
  spot: Spot;
  onPublished: () => void;
}

export function TimeStep({ spot, onPublished }: TimeStepProps) {
  const trpc = useTRPC();

  // Seed start/end from EXIF capturedAt stored on completed items
  const queue = useUploadStore((s) => s.uploadQueue);
  const completedItems = useMemo(
    () => queue.filter((item) => item.spotId === spot.id && item.status === 'completed' && item.mediaId),
    [queue, spot.id],
  );
  const mediaIds = useMemo(() => completedItems.map((item) => item.mediaId!), [completedItems]);
  const exifDates = useMemo(
    () => completedItems.filter((item) => item.capturedAt).map((item) => item.capturedAt!),
    [completedItems],
  );

  const [date, setDate] = useState<Date | null>(() => {
    if (exifDates.length === 0) return new Date();
    return new Date(Math.min(...exifDates.map((d) => d.getTime())));
  });

  const [range, setRange] = useState<[number, number]>(() => {
    if (exifDates.length === 0) return [360, 600]; // 06:00 – 10:00
    const start = Math.min(...exifDates.map(dateToMinutes));
    const end = Math.max(...exifDates.map(dateToMinutes));
    return [start, Math.max(start + 15, end)];
  });

  const startTime = minutesToTime(range[0]);
  const endTime = minutesToTime(range[1]);

  const startsAt = date ? combineDateAndTime(date, startTime) : null;
  const endsAt = date ? combineDateAndTime(date, endTime) : null;
  const canPublish = !!date && range[0] < range[1];

  const { mutateAsync: createAndPublish, isPending } = useMutation(
    trpc.sessions.createAndPublish.mutationOptions(),
  );

  const handlePublish = useCallback(async () => {
    if (!startsAt || !endsAt) return;
    await createAndPublish({ spotId: spot.id, startsAt, endsAt, mediaIds });
    onPublished();
  }, [spot.id, startsAt, endsAt, mediaIds, createAndPublish, onPublished]);

  const handleDateChange = (val: Date | string | null) => {
    if (!val) { setDate(null); return; }
    setDate(typeof val === 'string' ? new Date(val) : val);
  };

  return (
    <Stack gap="md" p="md" align="center">
      <Text size="sm" fw={500} style={{ color: '#fff' }}>When did you surf?</Text>

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

      <Stack gap={6} w="100%">
        <Text size="xs" style={{ color: 'rgba(255,255,255,0.65)', textAlign: 'center' }}>
          {minutesToTime(range[0])} – {minutesToTime(range[1])}
        </Text>
        <RangeSlider
          value={range}
          onChange={setRange}
          min={0}
          max={1440}
          step={15}
          minRange={15}
          label={minutesToTime}
        />
      </Stack>

      <Button
        onClick={() => { void handlePublish(); }}
        disabled={!canPublish}
        loading={isPending}
        fullWidth
      >
        Publish session
      </Button>
    </Stack>
  );
}
