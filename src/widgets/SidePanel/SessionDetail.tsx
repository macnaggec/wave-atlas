import { useCallback, useMemo, useState } from 'react';
import { Center, Skeleton, Text } from '@mantine/core';
import { useSessionMedia } from 'entities/SurfSession';
import type { SurfSessionItem } from 'entities/SurfSession';
import { useCartToggle } from 'entities/Commerce';
import { MediaLightbox, PublicCard, type LightboxMedia, type DisplayMedia } from 'features/PublicGallery';
import { useUser } from 'shared/hooks/useUser';
import { BaseGallery } from 'shared/ui/BaseGallery';

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

  const lightboxItems = useMemo(
    () => (media ?? []).map((i) => ({ ...i, type: (i.type === 'VIDEO' ? 'video' : 'image') as 'image' | 'video' })),
    [media],
  );

  const handleCartToggle = useCallback(
    (item: Omit<LightboxMedia, 'type'>) => toggleCartItem(item),
    [toggleCartItem],
  );

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ padding: '6px 12px', flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <Text size="xs" c="dimmed">{session.spot.location}</Text>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {isLoading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, padding: '0 12px' }}>
            {Array.from({ length: session.mediaCount || 6 }).map((_, i) => (
              <Skeleton key={i} height={0} style={{ paddingBottom: '62.5%', borderRadius: 8 }} />
            ))}
          </div>
        ) : (
          <div style={{ padding: '0 12px' }}>
            <BaseGallery
              items={media ?? []}
              renderCard={(item, { index }) => {
                const isOwn = ownedItemIds.has(item.id);
                const isInCart = cartItemIds.has(item.id);
                const displayMedia: DisplayMedia = {
                  id: item.id,
                  thumbnailUrl: item.thumbnailUrl,
                  resource: {
                    resourceType: item.type === 'VIDEO' ? 'video' : 'image',
                    url: item.thumbnailUrl,
                    assetId: item.id,
                  },
                };
                return (
                  <PublicCard
                    mediaItem={displayMedia}
                    actions={item.price > 0 && !isOwn ? ['cart'] : []}
                    activeActions={isInCart ? ['cart'] : []}
                    onAction={() => handleCartToggle(item)}
                    onCardClick={() => setLightboxIndex(index)}
                    showOwnerBadge={isOwn}
                  />
                );
              }}
              emptyState={
                <Center h={200}>
                  <Text size="sm" c="dimmed">No media</Text>
                </Center>
              }
            />
          </div>
        )}
      </div>

      {lightboxItems.length > 0 && (
        <MediaLightbox
          items={lightboxItems}
          initialIndex={lightboxIndex ?? 0}
          opened={lightboxIndex !== null}
          onClose={() => setLightboxIndex(null)}
          cartItemIds={cartItemIds}
          onCartToggle={handleCartToggle}
          ownedItemIds={ownedItemIds}
        />
      )}
    </div>
  );
}
