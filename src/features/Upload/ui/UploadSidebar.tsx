import { useState, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button, Center, Divider, Group, Stack, Text, Title } from '@mantine/core';
import { DatePicker, TimeInput } from '@mantine/dates';
import { IconLogin2, IconArrowLeft, IconClock } from '@tabler/icons-react';
import { useTRPC } from 'app/lib/trpc';
import { useUser } from 'shared/hooks/useUser';
import { useAuthModal } from 'features/Auth/AuthModalProvider';
import { useDraftMedia } from '../model/useDraftMedia';
import { UploadManager } from './UploadManager';
import SpotSelect from './SpotSelect/SpotSelect';
import type { Spot } from 'entities/Spot/types';

type SessionMeta = {
  id: string;
  spotId: string;
  spotName: string;
  spotLocation: string;
  startsAt: Date;
  endsAt: Date;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function combineDateAndTime(date: Date, timeStr: string): Date {
  const [h, m] = timeStr.split(':').map(Number);
  const result = new Date(date);
  result.setHours(h || 0, m || 0, 0, 0);
  return result;
}

// ─── Step 1: Session form ────────────────────────────────────────────────────

function SessionForm({ onCreated }: { onCreated: (meta: SessionMeta) => void }) {
  const trpc = useTRPC();
  const [spot, setSpot] = useState<Spot | null>(null);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [startTime, setStartTime] = useState('09:00');
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [endTime, setEndTime] = useState('11:00');

  const { mutateAsync: createSession, isPending } = useMutation(
    trpc.sessions.create.mutationOptions(),
  );

  const startsAt = startDate ? combineDateAndTime(startDate, startTime) : null;
  const endsAt = endDate ? combineDateAndTime(endDate, endTime) : null;
  const timeError = startsAt && endsAt && startsAt >= endsAt ? 'End must be after start' : null;
  const canSubmit = !!spot && !!startsAt && !!endsAt && !timeError && !isPending;

  const handleDateChange =
    (setter: (d: Date | null) => void) => (val: Date | string | null) => {
      if (!val) { setter(null); return; }
      setter(typeof val === 'string' ? new Date(val) : val);
    };

  const handleSubmit = useCallback(async () => {
    if (!spot || !startsAt || !endsAt) return;
    const session = await createSession({ spotId: spot.id, startsAt, endsAt });
    onCreated({
      id: session.id,
      spotId: spot.id,
      spotName: spot.name,
      spotLocation: spot.location,
      startsAt,
      endsAt,
    });
  }, [spot, startsAt, endsAt, createSession, onCreated]);

  return (
    <Stack gap="md" p="md">
      <Title order={5}>New session</Title>

      <Stack gap="xs">
        <Text size="sm" fw={500} c="dimmed">Spot *</Text>
        <SpotSelect onSelect={setSpot} selectedSpot={spot} />
      </Stack>

      <Group grow align="flex-start" gap="sm">
        <Stack gap="xs">
          <Text size="sm" fw={500} c="dimmed">Start *</Text>
          <DatePicker value={startDate} onChange={handleDateChange(setStartDate)} size="xs" />
          <TimeInput
            value={startTime}
            onChange={(e) => setStartTime(e.currentTarget.value)}
            leftSection={<IconClock size={14} />}
            size="xs"
          />
        </Stack>
        <Stack gap="xs">
          <Text size="sm" fw={500} c="dimmed">End *</Text>
          <DatePicker
            value={endDate}
            onChange={handleDateChange(setEndDate)}
            minDate={startDate ?? undefined}
            size="xs"
          />
          <TimeInput
            value={endTime}
            onChange={(e) => setEndTime(e.currentTarget.value)}
            leftSection={<IconClock size={14} />}
            size="xs"
          />
        </Stack>
      </Group>

      {timeError && <Text size="xs" c="red">{timeError}</Text>}

      <Button onClick={handleSubmit} disabled={!canSubmit} loading={isPending} fullWidth>
        Start uploading
      </Button>
    </Stack>
  );
}

// ─── Step 2: Upload for the created session ──────────────────────────────────

function SessionUpload({ meta, onBack }: { meta: SessionMeta; onBack: () => void }) {
  const { draftMedia } = useDraftMedia(meta.id);

  return (
    <Stack gap={0}>
      <Group px="md" py="sm">
        <Button
          variant="subtle"
          size="xs"
          leftSection={<IconArrowLeft size={14} />}
          onClick={onBack}
          px={6}
        >
          Change session
        </Button>
      </Group>

      <Divider />

      <Stack gap={2} px="md" py="xs">
        <Text size="sm" fw={600}>{meta.spotName}</Text>
        <Text size="xs" c="dimmed">{meta.spotLocation}</Text>
        <Text size="xs" c="dimmed">
          {meta.startsAt.toLocaleString()} – {meta.endsAt.toLocaleString()}
        </Text>
      </Stack>

      <Divider />

      <UploadManager
        spotId={meta.spotId}
        sessionId={meta.id}
        spotName={meta.spotName}
        draftMedia={draftMedia}
      />
    </Stack>
  );
}

// ─── Auth gate + root ─────────────────────────────────────────────────────────

export function UploadSidebar() {
  const { isAuthenticated, isLoading } = useUser();
  const { open: openAuthModal } = useAuthModal();
  const [session, setSession] = useState<SessionMeta | null>(null);

  if (isLoading) return null;

  if (!isAuthenticated) {
    return (
      <Center mih={260}>
        <Stack gap="xs" align="center" ta="center">
          <Title order={4}>Sign in to upload</Title>
          <Text c="dimmed" maw={320}>
            Uploads are tied to your account so you can manage them later.
          </Text>
          <Button leftSection={<IconLogin2 size={16} />} onClick={openAuthModal}>
            Sign in
          </Button>
        </Stack>
      </Center>
    );
  }

  if (session) {
    return <SessionUpload meta={session} onBack={() => setSession(null)} />;
  }

  return <SessionForm onCreated={setSession} />;
}
