import { useQuery } from '@tanstack/react-query';
import { Center, Loader, Skeleton, Text } from '@mantine/core';
import { useTRPC } from 'app/lib/trpc';
import type { SurfSessionItem } from 'entities/SurfSession/types';

interface SessionDetailProps {
  session: SurfSessionItem;
}

export function SessionDetail({ session }: SessionDetailProps) {
  const trpc = useTRPC();
  const { data: media, isLoading } = useQuery(
    trpc.sessions.media.queryOptions(session.id),
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
          {media.map((item) => (
            <div
              key={item.id}
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
            </div>
          ))}
        </div>
      )}
      </div>
    </div>
  );
}
