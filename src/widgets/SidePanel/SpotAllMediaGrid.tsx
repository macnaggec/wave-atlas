import { useState, useMemo } from 'react';
import { Center, Loader, Skeleton, Text } from '@mantine/core';
import { useSpotMediaFeed } from 'entities/Spot/model/useSpotMediaFeed';
import type { SpotMediaItem } from 'entities/Media/types';

type SortOrder = 'desc' | 'asc';

interface SpotAllMediaGridProps {
  spotId: string;
}

function MediaTile({ item }: { item: SpotMediaItem }) {
  return (
    <div
      style={{
        position: 'relative',
        aspectRatio: '16 / 10',
        borderRadius: 8,
        overflow: 'hidden',
        background: 'rgba(255,255,255,0.06)',
      }}
    >
      <img
        src={item.thumbnailUrl}
        alt=""
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
      {item.photographer?.name && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            background: 'linear-gradient(transparent, rgba(0,0,0,0.65))',
            padding: '14px 5px 4px',
            fontSize: 9,
            fontWeight: 500,
            color: 'rgba(255,255,255,0.8)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {item.photographer.name}
        </div>
      )}
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.08)',
  border: '1px solid rgba(255,255,255,0.14)',
  color: '#fff',
  borderRadius: 6,
  padding: '4px 8px',
  fontSize: 12,
  cursor: 'pointer',
};

export function SpotAllMediaGrid({ spotId }: SpotAllMediaGridProps) {
  const [sort, setSort] = useState<SortOrder>('desc');
  const [photographerId, setPhotographerId] = useState<string>('');

  const { flatItems, isLoading, isFetchingNextPage, fetchNextPage, hasNextPage } =
    useSpotMediaFeed(spotId, sort);

  const photographers = useMemo(() => {
    const map = new Map<string, string>();
    flatItems.forEach((item) => {
      if (item.photographer?.id) {
        map.set(item.photographer.id, item.photographer.name ?? item.photographer.id);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [flatItems]);

  const displayed = photographerId
    ? flatItems.filter((item) => item.photographer?.id === photographerId)
    : flatItems;

  return (
    <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      {/* Filter bar — only rendered in C-all */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          padding: '8px 12px',
          flexShrink: 0,
          borderBottom: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        <select value={sort} onChange={(e) => setSort(e.target.value as SortOrder)} style={selectStyle}>
          <option value="desc">Newest ▾</option>
          <option value="asc">Oldest ▾</option>
        </select>

        {photographers.length > 1 && (
          <select
            value={photographerId}
            onChange={(e) => setPhotographerId(e.target.value)}
            style={selectStyle}
          >
            <option value="">Photographer ▾</option>
            {photographers.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}
      </div>

      {isLoading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, padding: '8px 12px' }}>
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} height={0} style={{ paddingBottom: '62.5%', borderRadius: 8 }} />
          ))}
        </div>
      ) : displayed.length === 0 ? (
        <Center h={200}>
          <Text size="sm" c="dimmed">No media yet</Text>
        </Center>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, padding: '8px 12px' }}>
            {displayed.map((item) => (
              <MediaTile key={item.id} item={item} />
            ))}
          </div>
          {hasNextPage && !isFetchingNextPage && (
            <Center py="md">
              <Loader size="sm" onClick={() => void fetchNextPage()} style={{ cursor: 'pointer' }} />
            </Center>
          )}
          {isFetchingNextPage && <Center py="md"><Loader size="sm" /></Center>}
        </>
      )}
    </div>
  );
}
