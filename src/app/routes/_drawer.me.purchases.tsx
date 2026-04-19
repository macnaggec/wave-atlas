import { createFileRoute } from '@tanstack/react-router';
import { ActionIcon, Card, Center, Group, Image, Loader, Modal, SimpleGrid, Text, Tooltip } from '@mantine/core';
import { IconDownload } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { useTRPC } from 'app/lib/trpc';
import { usePurchaseDownload } from 'features/Cart/model/usePurchaseDownload';
import { formatPrice } from 'shared/lib/currency';
import { ImageWithSkeleton } from 'shared/ui';

export const Route = createFileRoute('/_drawer/me/purchases')({
  component: PurchasesTab,
});

/**
 * PurchasesTab — shows media purchased by the authenticated user.
 * Clicking a thumbnail opens a clean (no-watermark) preview modal.
 * Download triggers a server-side signed URL generation with purchase ownership check.
 */
function PurchasesTab() {
  const trpc = useTRPC();
  const { data: purchases = [], isLoading } = useQuery(trpc.checkout.myPurchases.queryOptions());
  const { download, isDownloading, isAnyDownloading } = usePurchaseDownload();

  const [lightboxMediaItemId, setLightboxMediaItemId] = useState<string | null>(null);

  const lightboxPurchase = purchases.find(p => p.mediaItem.id === lightboxMediaItemId) ?? null;

  if (isLoading) {
    return (
      <Center mih={200}>
        <Loader size="sm" />
      </Center>
    );
  }

  if (purchases.length === 0) {
    return (
      <Center mih={200}>
        <Text c="dimmed" size="sm">Your purchases will appear here.</Text>
      </Center>
    );
  }

  return (
    <>
      <SimpleGrid cols={2} spacing="sm" p="sm">
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
              <Image
                src={p.mediaItem.thumbnailUrl}
                height={120}
                fit="cover"
                alt="Purchased media"
              />
            </Card.Section>

            <Group justify="space-between" mt="xs" wrap="nowrap">
              <Text size="xs" c="dimmed">
                {formatPrice(Math.round(p.amountPaid * 100))}
              </Text>
              <DownloadButton
                mediaItemId={p.mediaItem.id}
                size="sm"
                loading={isDownloading(p.mediaItem.id)}
                disabled={isAnyDownloading}
                onDownload={download}
                stopPropagation
              />
            </Group>
          </Card>
        ))}
      </SimpleGrid>

      <Modal
        opened={lightboxPurchase !== null}
        onClose={() => setLightboxMediaItemId(null)}
        size="xl"
        padding="sm"
        centered
        withCloseButton
      >
        {lightboxPurchase && (
          <Group align="flex-end" justify="flex-end" mb="sm">
            <DownloadButton
              mediaItemId={lightboxPurchase.mediaItem.id}
              size="md"
              loading={isDownloading(lightboxPurchase.mediaItem.id)}
              disabled={isAnyDownloading}
              onDownload={download}
            />
          </Group>
        )}
        {lightboxPurchase?.previewUrl && (
          <ImageWithSkeleton
            key={lightboxMediaItemId}
            src={lightboxPurchase.previewUrl}
            alt="Purchased media preview"
            mah="70vh"
          />
        )}
      </Modal>
    </>
  );
}

// ============================================================================
// PRIVATE HELPERS
// ============================================================================

interface DownloadButtonProps {
  mediaItemId: string;
  size: 'sm' | 'md';
  loading: boolean;
  disabled: boolean;
  onDownload: (mediaItemId: string) => void;
  stopPropagation?: boolean;
}

function DownloadButton({ mediaItemId, size, loading, disabled, onDownload, stopPropagation }: DownloadButtonProps) {
  const handleClick = useCallback(
    (e: { stopPropagation: () => void }) => {
      if (stopPropagation) e.stopPropagation();
      onDownload(mediaItemId);
    },
    [mediaItemId, onDownload, stopPropagation],
  );

  return (
    <Tooltip label="Download original" withArrow>
      <ActionIcon
        variant={size === 'md' ? 'light' : 'subtle'}
        size={size}
        loading={loading}
        disabled={disabled}
        onClick={handleClick}
        aria-label="Download original file"
      >
        <IconDownload size={size === 'md' ? 16 : 14} />
      </ActionIcon>
    </Tooltip>
  );
}
