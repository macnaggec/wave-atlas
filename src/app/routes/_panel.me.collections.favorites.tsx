import { useMemo, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Center, Loader, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useTRPC } from 'shared/lib/trpc';
import { useUser } from 'shared/hooks/useUser';
import { BaseGallery } from 'shared/ui/BaseGallery';
import { PanelGalleryLayout } from 'shared/ui/PanelGalleryLayout';
import { useCartToggle } from 'entities/Commerce';
import { useMediaFavorites } from 'entities/Media';
import { MediaLightbox, PublicCard, type DisplayMedia } from 'features/PublicGallery';

export const Route = createFileRoute('/_panel/me/collections/favorites')({ component: FavoritesTab });

function FavoritesTab() {
  const trpc = useTRPC();
  const { user } = useUser();
  const { data: favorites = [], isLoading } = useQuery(trpc.media.favorites.queryOptions());
  const { toggleFavorite } = useMediaFavorites();
  const { cartItemIds, toggleCartItem } = useCartToggle('');
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const ownedItemIds = useMemo(() => new Set(favorites.filter((item) => item.photographerId === user?.id).map((item) => item.id)), [favorites, user?.id]);
  const purchasedItemIds = useMemo(() => new Set(favorites.filter((item) => item.viewerEntitlement.purchaseState === 'purchased').map((item) => item.id)), [favorites]);
  const lightboxItems = useMemo(() => favorites.map((item) => ({ ...item, type: item.type === 'VIDEO' ? 'video' as const : 'image' as const })), [favorites]);

  if (isLoading) return <PanelGalleryLayout><Center mih={200}><Loader size="sm" /></Center></PanelGalleryLayout>;
  if (favorites.length === 0) return <PanelGalleryLayout><Center mih={200}><Text c="dimmed" size="sm">Your favorites will appear here.</Text></Center></PanelGalleryLayout>;

  return (
    <>
      <PanelGalleryLayout>
        <BaseGallery
          items={favorites}
          aria-label="Favorites"
          renderCard={(item, { index }) => {
            const isOwn = ownedItemIds.has(item.id);
            const isPurchased = purchasedItemIds.has(item.id);
            const displayMedia: DisplayMedia = {
              id: item.id,
              thumbnailUrl: item.thumbnailUrl,
              price: item.price,
              capturedAt: item.capturedAt,
              width: item.width,
              height: item.height,
              resource: { resourceType: item.type === 'VIDEO' ? 'video' : 'image', url: item.lightboxUrl, assetId: item.id },
            };
            return (
              <PublicCard
                mediaItem={displayMedia}
                actions={!isOwn && !isPurchased && item.price > 0 ? ['cart', 'favorites'] : ['favorites']}
                activeActions={[...(cartItemIds.has(item.id) ? ['cart' as const] : []), 'favorites']}
                onAction={(action) => action === 'cart' ? toggleCartItem(item) : toggleFavorite(item)}
                onCardClick={() => setLightboxIndex(index)}
                showOwnerBadge={isOwn}
                showPurchasedBadge={isPurchased}
              />
            );
          }}
        />
      </PanelGalleryLayout>
      <MediaLightbox
        items={lightboxItems}
        initialIndex={lightboxIndex ?? 0}
        opened={lightboxIndex !== null}
        onClose={() => setLightboxIndex(null)}
        cartItemIds={cartItemIds}
        onCartToggle={toggleCartItem}
        favoriteItemIds={new Set(favorites.map((item) => item.id))}
        onFavoriteToggle={(lightboxItem) => {
          const item = favorites.find((candidate) => candidate.id === lightboxItem.id);
          if (item) toggleFavorite(item);
        }}
        ownedItemIds={ownedItemIds}
        purchasedItemIds={purchasedItemIds}
      />
    </>
  );
}
