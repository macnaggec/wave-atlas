import { useCallback, useMemo, useState } from 'react';
import { Center, Skeleton, Text } from '@mantine/core';
import { IconCamera, IconMapPin } from '@tabler/icons-react';
import { useSessionMedia } from 'entities/SurfSession';
import type { SurfSessionItem } from 'entities/SurfSession';
import { useCartToggle } from 'entities/Commerce';
import { MediaLightbox, PublicCard, type LightboxMedia, type DisplayMedia } from 'features/PublicGallery';
import { useUser } from 'shared/hooks/useUser';
import { BaseGallery } from 'shared/ui/BaseGallery';
import { PanelGalleryLayout } from 'shared/ui/PanelGalleryLayout';
import styles from './SessionDetail.module.css';

interface SessionDetailProps {
  session: SurfSessionItem;
}

export function SessionDetail({ session }: SessionDetailProps) {
  const { data: media, isLoading } = useSessionMedia(session.id);

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const { user } = useUser();
  const { cartItemIds, toggleCartItem } = useCartToggle(session.spot.name);

  const ownedItemIds = useMemo(
    () => new Set((media ?? []).filter((m) => m.photographerId === user?.id).map((m) => m.id)),
    [media, user?.id],
  );
  const purchasedItemIds = useMemo(
    () => new Set((media ?? []).filter((m) => m.viewerEntitlement.purchaseState === 'purchased').map((m) => m.id)),
    [media],
  );

  const lightboxItems = useMemo(
    () => (media ?? []).map((i) => ({ ...i, type: (i.type === 'VIDEO' ? 'video' : 'image') as 'image' | 'video' })),
    [media],
  );

  const handleCartToggle = useCallback(
    (item: Omit<LightboxMedia, 'type'>) => toggleCartItem(item),
    [toggleCartItem],
  );

  const photographerName = session.photographer.name ?? 'Unknown photographer';

  return (
    <>
      <PanelGalleryLayout
        meta={
          <div className={styles.metaRow}>
            <IconMapPin size={12} className={styles.metaIcon} />
            <Text component="span" size="xs" fw={600} truncate className={styles.metaPrimary}>
              {session.spot.name}
            </Text>
            <Text component="span" size="xs" c="dimmed" className={styles.separator}>·</Text>
            <Text component="span" size="xs" c="dimmed" truncate className={styles.metaLocation}>
              {session.spot.location}
            </Text>
            <Text component="span" size="xs" c="dimmed" className={styles.separator}>·</Text>
            <IconCamera size={12} className={styles.metaIcon} />
            <Text component="span" size="xs" c="dimmed" truncate className={styles.metaPhotographer}>
              {photographerName}
            </Text>
          </div>
        }
      >
        {isLoading ? (
          <div className={styles.skeletonGrid}>
            {Array.from({ length: session.mediaCount || 6 }).map((_, i) => (
              <Skeleton key={i} height={0} style={{ paddingBottom: '62.5%', borderRadius: 8 }} />
            ))}
          </div>
        ) : (
          <BaseGallery
            items={media ?? []}
            renderCard={(item, { index }) => {
              const isOwn = ownedItemIds.has(item.id);
              const isPurchased = purchasedItemIds.has(item.id);
              const isInCart = cartItemIds.has(item.id);
              const displayMedia: DisplayMedia = {
                id: item.id,
                thumbnailUrl: item.thumbnailUrl,
                resource: {
                  resourceType: item.type === 'VIDEO' ? 'video' : 'image',
                  url: item.type === 'VIDEO' ? item.lightboxUrl : item.thumbnailUrl,
                  assetId: item.id,
                },
              };

              return (
                <PublicCard
                  mediaItem={displayMedia}
                  actions={item.price > 0 && !isOwn && !isPurchased ? ['cart'] : []}
                  activeActions={isInCart ? ['cart'] : []}
                  onAction={() => handleCartToggle(item)}
                  onCardClick={() => setLightboxIndex(index)}
                  showOwnerBadge={isOwn}
                  showPurchasedBadge={isPurchased}
                />
              );
            }}
            emptyState={
              <Center h={200}>
                <Text size="sm" c="dimmed">No media</Text>
              </Center>
            }
          />
        )}
      </PanelGalleryLayout>

      {lightboxItems.length > 0 && (
        <MediaLightbox
          items={lightboxItems}
          initialIndex={lightboxIndex ?? 0}
          opened={lightboxIndex !== null}
          onClose={() => setLightboxIndex(null)}
          cartItemIds={cartItemIds}
          onCartToggle={handleCartToggle}
          ownedItemIds={ownedItemIds}
          purchasedItemIds={purchasedItemIds}
        />
      )}
    </>
  );
}
