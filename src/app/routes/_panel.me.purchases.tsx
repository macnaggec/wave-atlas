import { createFileRoute } from '@tanstack/react-router';
import { Center, Loader, SimpleGrid, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTRPC } from 'shared/lib/trpc';
import { useCartStore } from 'entities/Commerce';
import { PurchaseCard, PurchaseLightbox, usePurchaseDownload } from 'features/Purchases';

export const Route = createFileRoute('/_panel/me/purchases')({
  validateSearch: (search): { order?: string } => ({
    order: typeof search.order === 'string' ? search.order : undefined,
  }),
  component: PurchasesTab,
});

function PurchasesTab() {
  const { order } = Route.useSearch();
  const trpc = useTRPC();
  const { data: purchases = [], isLoading } = useQuery(trpc.checkout.myPurchases.queryOptions());
  const { download, isDownloading, isAnyDownloading } = usePurchaseDownload();
  const removeFromCart = useCartStore((s) => s.remove);

  const [lightboxMediaItemId, setLightboxMediaItemId] = useState<string | null>(null);
  const lightboxPurchase = purchases.find(p => p.mediaItem.id === lightboxMediaItemId) ?? null;

  useEffect(() => {
    if (!order || isLoading || purchases.length === 0) return;

    purchases.forEach((purchase) => removeFromCart(purchase.mediaItem.id));
  }, [isLoading, order, purchases, removeFromCart]);

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
        {purchases.map((purchase) => (
          <PurchaseCard
            key={purchase.id}
            purchase={purchase}
            isDownloading={isDownloading(purchase.mediaItem.id)}
            isAnyDownloading={isAnyDownloading}
            onDownload={download}
            onPreview={setLightboxMediaItemId}
          />
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
