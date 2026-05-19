import { createFileRoute } from '@tanstack/react-router';
import { Card, Center, Group, Image, Loader, SimpleGrid, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTRPC } from 'app/lib/trpc';
import { usePurchaseDownload } from 'features/Cart/model/usePurchaseDownload';
import DownloadButton from 'features/Cart/ui/DownloadButton';
import PurchaseLightbox from 'features/Cart/ui/PurchaseLightbox';
import { formatPrice } from 'shared/lib/currency';

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
                {formatPrice(p.amountPaid)}
              </Text>
              <span onClick={e => e.stopPropagation()}>
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
