import { useState } from 'react';
import {
  Badge,
  Card,
  Center,
  Group,
  Image,
  Loader,
  Select,
  SimpleGrid,
  Skeleton,
  Stack,
  Tabs,
  Text,
} from '@mantine/core';
import { IconCalendar, IconMapPin, IconPhoto } from '@tabler/icons-react';
import { useMemo } from 'react';
import { useMySessions } from 'entities/SurfSession';
import { useMyPurchases } from 'entities/Commerce';
import type { SurfSessionItem } from 'entities/SurfSession';
import { formatDateRange } from 'shared/lib/dateUtils';
import { usePurchaseDownload } from 'entities/Commerce';
import DownloadButton from 'features/Cart/ui/DownloadButton';
import PurchaseLightbox from 'features/Cart/ui/PurchaseLightbox';
import { formatPrice } from 'shared/lib/currency';

// ─── Uploads tab ─────────────────────────────────────────────────────────────

function SessionCard({ session }: { session: SurfSessionItem }) {
  const isDraft = session.status === 'DRAFT';
  return (
    <Stack
      gap={0}
      style={{
        borderRadius: 8,
        border: '1px solid rgba(255,255,255,0.1)',
        overflow: 'hidden',
        cursor: 'pointer',
      }}
    >
      {session.thumbnailUrl ? (
        <Image src={session.thumbnailUrl} h={120} style={{ objectFit: 'cover', width: '100%' }} />
      ) : (
        <Center h={120} style={{ background: 'rgba(255,255,255,0.04)' }}>
          <IconPhoto size={28} color="rgba(255,255,255,0.2)" />
        </Center>
      )}
      <Stack gap={4} p="xs">
        <Group gap={4} wrap="nowrap" justify="space-between">
          <Group gap={4} wrap="nowrap" style={{ minWidth: 0 }}>
            <IconMapPin size={11} style={{ color: 'rgba(255,255,255,0.45)', flexShrink: 0 }} />
            <Text size="xs" fw={600} truncate>{session.spot.name}</Text>
          </Group>
          {isDraft && <Badge size="xs" color="yellow" variant="light">Draft</Badge>}
        </Group>
        <Group gap={4} wrap="nowrap">
          <IconCalendar size={11} style={{ color: 'rgba(255,255,255,0.35)', flexShrink: 0 }} />
          <Text size="xs" c="dimmed" style={{ fontSize: 10 }}>
            {formatDateRange(session.startsAt, session.endsAt)}
          </Text>
        </Group>
        <Text size="xs" c="dimmed">{session.mediaCount} item{session.mediaCount !== 1 ? 's' : ''}</Text>
      </Stack>
    </Stack>
  );
}

function UploadsContent() {
  const { data: sessions = [], isLoading } = useMySessions();
  const [spotFilter, setSpotFilter] = useState<string | null>(null);

  const spotOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const s of sessions) {
      if (!seen.has(s.spot.id)) seen.set(s.spot.id, s.spot.name);
    }
    return Array.from(seen.entries()).map(([value, label]) => ({ value, label }));
  }, [sessions]);

  const visible = useMemo(
    () => (spotFilter ? sessions.filter((s) => s.spot.id === spotFilter) : sessions),
    [sessions, spotFilter],
  );

  if (isLoading) {
    return (
      <SimpleGrid cols={2} spacing="xs" mt="sm">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} height={160} radius="sm" />)}
      </SimpleGrid>
    );
  }

  if (sessions.length === 0) {
    return (
      <Center mih={200}>
        <Text c="dimmed" size="sm">No sessions yet. Upload your first session!</Text>
      </Center>
    );
  }

  return (
    <Stack gap="sm">
      {spotOptions.length > 1 && (
        <Select
          placeholder="All spots"
          data={spotOptions}
          value={spotFilter}
          onChange={setSpotFilter}
          clearable
          size="xs"
          leftSection={<IconMapPin size={13} />}
        />
      )}
      <SimpleGrid cols={2} spacing="xs">
        {visible.map((s) => <SessionCard key={s.id} session={s} />)}
      </SimpleGrid>
    </Stack>
  );
}

// ─── Purchases tab ───────────────────────────────────────────────────────────

function PurchasesContent() {
  const { data: purchases = [], isLoading } = useMyPurchases();
  const { download, isDownloading, isAnyDownloading } = usePurchaseDownload();
  const [lightboxMediaItemId, setLightboxMediaItemId] = useState<string | null>(null);
  const lightboxPurchase = purchases.find((p) => p.mediaItem.id === lightboxMediaItemId) ?? null;

  if (isLoading) {
    return <Center mih={200}><Loader size="sm" /></Center>;
  }

  if (purchases.length === 0) {
    return <Center mih={200}><Text c="dimmed" size="sm">Your purchases will appear here.</Text></Center>;
  }

  return (
    <>
      <SimpleGrid cols={2} spacing="sm">
        {purchases.map((p) => (
          <Card
            key={p.id}
            padding="xs"
            radius="md"
            withBorder
            style={{ cursor: p.previewUrl ? 'pointer' : 'default' }}
            onClick={() => p.previewUrl && setLightboxMediaItemId(p.mediaItem.id)}
          >
            <Card.Section>
              <Image src={p.mediaItem.thumbnailUrl} height={120} fit="cover" alt="Purchased media" />
            </Card.Section>
            <Group justify="space-between" mt="xs" wrap="nowrap">
              <Text size="xs" c="dimmed">{formatPrice(p.amountPaid)}</Text>
              <span onClick={(e) => e.stopPropagation()}>
                <DownloadButton
                  mediaItemId={p.mediaItem.id}
                  size="sm"
                  loading={isDownloading(p.mediaItem.id)}
                  disabled={isAnyDownloading}
                  onDownload={download}
                />
              </span>
            </Group>
          </Card>
        ))}
      </SimpleGrid>
      <PurchaseLightbox
        purchase={lightboxPurchase}
        onClose={() => setLightboxMediaItemId(null)}
        isDownloading={isDownloading(lightboxPurchase?.mediaItem.id ?? '')}
        isAnyDownloading={isAnyDownloading}
        onDownload={download}
      />
    </>
  );
}

// ─── Favorites tab ───────────────────────────────────────────────────────────

function FavoritesContent() {
  return (
    <Center mih={200}>
      <Text c="dimmed" size="sm">Your favorites will appear here.</Text>
    </Center>
  );
}

// ─── MyCollection ─────────────────────────────────────────────────────────────

type Tab = 'uploads' | 'purchases' | 'favorites';

export function MyCollection() {
  const [tab, setTab] = useState<Tab>('uploads');

  return (
    <Stack gap={0} style={{ flex: 1, minHeight: 0 }}>
      <Tabs value={tab} onChange={(v) => v && setTab(v as Tab)}>
        <Tabs.List px="xs">
          <Tabs.Tab value="uploads" fz="xs">My Uploads</Tabs.Tab>
          <Tabs.Tab value="purchases" fz="xs">Purchases</Tabs.Tab>
          <Tabs.Tab value="favorites" fz="xs">Favorites</Tabs.Tab>
        </Tabs.List>
      </Tabs>

      <div style={{ padding: '12px', flex: 1, minHeight: 0 }}>
        {tab === 'uploads' && <UploadsContent />}
        {tab === 'purchases' && <PurchasesContent />}
        {tab === 'favorites' && <FavoritesContent />}
      </div>
    </Stack>
  );
}
