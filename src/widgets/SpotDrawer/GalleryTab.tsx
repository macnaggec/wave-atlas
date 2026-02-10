'use client';

import { useMemo } from 'react';
import { Text, Menu, rem } from '@mantine/core';
import { IconShoppingBag } from '@tabler/icons-react';
import { Gallery } from 'widgets/Gallery';
import { MediaItem } from 'entities/Media/types';
import { MEDIA_RESOURCE_TYPE, MEDIA_STATUS } from 'entities/Media/constants';
import { useSpotDrawerContext } from './SpotDrawerContext';
import { useGallerySelection } from 'shared/hooks/gallery';
import PublicCard from 'widgets/Gallery/cards/PublicCard';
import SelectionToolbar from 'widgets/Gallery/toolbars/SelectionToolbar';

export function GalleryTab() {
  const { spotData } = useSpotDrawerContext();

  // Map server data to Gallery/MediaItem type
  const galleryMedia: MediaItem[] = useMemo(() => spotData?.media.map((m) => ({
    id: m.id,
    photographerId: m.photographer.id,
    spotId: spotData.id,
    capturedAt: m.capturedAt,
    price: m.price,
    watermarkUrl: m.url,
    originalUrl: m.url, // Not exposed here but required by type
    status: MEDIA_STATUS.PUBLISHED,
    createdAt: new Date(), // Details not fetched
    resource: {
      resource_type: m.type === 'VIDEO' ? MEDIA_RESOURCE_TYPE.VIDEO : MEDIA_RESOURCE_TYPE.IMAGE,
      url: m.url,
      playback_url: m.url,
      asset_id: m.id,
    },
  })) || [], [spotData]);

  // Use selection hook for cart functionality
  const selection = useGallerySelection({
    items: galleryMedia,
    getId: (item) => item.id,
  });

  return (
    <>
      {galleryMedia.length > 0 ? (
        <Gallery
          items={galleryMedia}
          selection={selection}
          renderCard={(item) => (
            <PublicCard
              mediaItem={item}
              actions={['cart', 'share']}
              onAction={(action) => {
                if (action === 'cart') {
                  // TODO: Implement add to cart
                }
              }}
            />
          )}
          toolbar={
            <SelectionToolbar
              selection={selection}
              renderActions={(selectedItems) => (
                <Menu.Item
                  leftSection={<IconShoppingBag style={{ width: rem(14), height: rem(14) }} />}
                  onClick={() => {
                    // TODO: Implement bulk add to cart
                  }}
                >
                  Add to cart
                </Menu.Item>
              )}
            />
          }
        />
      ) : (
        <Text c="dimmed" fs="italic">No media uploaded yet.</Text>
      )}
    </>
  );
}
