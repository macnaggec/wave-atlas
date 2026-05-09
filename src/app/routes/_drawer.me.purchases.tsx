import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Center, SimpleGrid, Skeleton, Text } from '@mantine/core';
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useEffectEvent, useState } from 'react';
import { useTRPC } from 'app/lib/trpc';
import { trpcProxy } from 'app/lib/trpcClient';
import { usePurchaseDownload } from 'features/Cart/model/usePurchaseDownload';
import PurchaseCard from 'features/Cart/ui/PurchaseCard';
import PurchaseLightbox from 'features/Cart/ui/PurchaseLightbox';
import { notify } from 'shared/lib/notifications';

export const Route = createFileRoute('/_drawer/me/purchases')({
  validateSearch: (search): { order?: string } => ({
    order: typeof search.order === 'string' ? search.order : undefined,
  }),
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(
    trpcProxy.checkout.myPurchases.queryOptions()
  ),
  pendingComponent: PurchasesPending,
  component: PurchasesTab,
});

function PurchasesPending() {
  return (
    <SimpleGrid cols={2} spacing="sm" p="sm">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} height={160} radius="md" />
      ))}
    </SimpleGrid>
  );
}

/**
 * PurchasesTab — shows media purchased by the authenticated user.
 * Clicking a thumbnail opens a clean (no-watermark) preview modal.
 * Download triggers a server-side signed URL generation with purchase ownership check.
 */
function PurchasesTab() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: purchases } = useSuspenseQuery(trpc.checkout.myPurchases.queryOptions());
  const { download, isDownloading, isAnyDownloading } = usePurchaseDownload();
  const { order } = Route.useSearch();

  const onPaymentReturn = useEffectEvent(() => {
    notify.success('Your files are ready to download.', 'Payment successful');
    void queryClient.invalidateQueries(trpc.checkout.myPurchases.queryOptions());
    void navigate({ to: '/me/purchases', search: {}, replace: true });
  });

  useEffect(() => {
    if (order) onPaymentReturn();
  }, [order]);

  const [lightboxMediaItemId, setLightboxMediaItemId] = useState<string | null>(null);
  const lightboxPurchase = useMemo(
    () => purchases.find((p) => p.mediaItem.id === lightboxMediaItemId) ?? null,
    [purchases, lightboxMediaItemId],
  );

  const handlePreview = useCallback((mediaItemId: string) => {
    setLightboxMediaItemId(mediaItemId);
  }, []);

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
          <PurchaseCard
            key={p.id}
            purchase={p}
            isDownloading={isDownloading(p.mediaItem.id)}
            isAnyDownloading={isAnyDownloading}
            onDownload={download}
            onPreview={handlePreview}
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
