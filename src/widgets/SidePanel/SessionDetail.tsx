import { useCallback, useMemo, useState } from 'react';
import { Center, Skeleton, Text } from '@mantine/core';
import { useSessionMedia } from 'entities/SurfSession/model/useSessionMedia';
import type { SurfSessionItem } from 'entities/SurfSession/types';
import type { MediaItem } from 'entities/Media/types';
import { useCartStore } from 'features/Cart/model/cartStore';
import { formatShortDate } from 'shared/lib/dateUtils';
import { MediaLightbox, PublicCard, type LightboxMedia } from 'features/PublicGallery';
import { useUser } from 'shared/hooks/useUser';

interface SessionDetailProps {
  session: SurfSessionItem;
}

export function SessionDetail({ session }: SessionDetailProps) {
  const { data: media, isLoading } = useSessionMedia(session.id);

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const { user } = useUser();
  const cartStoreItems = useCartStore((s) => s.items);
  const addToCart = useCartStore((s) => s.add);
  const removeFromCart = useCartStore((s) => s.remove);

  const cartItemIds = useMemo(
    () => new Set(cartStoreItems.map((i) => i.id)),
    [cartStoreItems],
  );

  const ownedItemIds = useMemo(
    () => new Set((media ?? []).filter((m) => m.photographerId === user?.id).map((m) => m.id)),
    [media, user?.id],
  );

  const handleCartToggle = useCallback(
    (item: LightboxMedia) => {
      if (cartItemIds.has(item.id)) {
        removeFromCart(item.id);
      } else {
        addToCart({
          id: item.id,
          label: `${session.spot.name} · ${formatShortDate(item.capturedAt)}`,
          spotName: session.spot.name,
          capturedAt: item.capturedAt instanceof Date ? item.capturedAt.toISOString() : String(item.capturedAt),
          thumbnailUrl: item.thumbnailUrl,
          lightboxUrl: item.lightboxUrl,
          priceCents: item.price,
        });
      }
    },
    [cartItemIds, removeFromCart, addToCart, session.spot.name],
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
      ) : !media || media.length === 0 ? (
        <Center h={200}>
          <Text size="sm" c="dimmed">No media</Text>
        </Center>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, padding: '0 12px' }}>
          {media.map((item, index) => {
            const isOwn = ownedItemIds.has(item.id);
            const isInCart = cartItemIds.has(item.id);
            const mediaItem: MediaItem = {
              ...item,
              resource: {
                resource_type: item.type === 'VIDEO' ? 'video' : 'image',
                url: item.thumbnailUrl,
                asset_id: item.id,
              },
              cloudinaryPublicId: '',
              status: 'PUBLISHED',
              createdAt: item.capturedAt,
            };
            return (
              <PublicCard
                key={item.id}
                mediaItem={mediaItem}
                actions={item.price > 0 && !isOwn ? ['cart'] : []}
                activeActions={isInCart ? ['cart'] : []}
                onAction={() => handleCartToggle(item)}
                onCardClick={() => setLightboxIndex(index)}
                showOwnerBadge={isOwn}
              />
            );
          })}
        </div>
      )}
      </div>

      {media && media.length > 0 && (
        <MediaLightbox
          items={media}
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
