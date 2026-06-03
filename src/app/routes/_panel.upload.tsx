import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { trpcProxy } from 'app/lib/trpcClient';
import { FeedSearch } from 'widgets/FeedDrawer';
import { UploadSidebar } from 'features/Upload/ui/UploadSidebar';
import type { Spot } from 'entities/Spot/types';

export const Route = createFileRoute('/_panel/upload')({
  validateSearch: (search): { spotId?: string } => ({
    spotId: typeof search.spotId === 'string' ? search.spotId : undefined,
  }),
  loaderDeps: ({ search }) => ({ spotId: search.spotId }),
  loader: async ({ context: { queryClient }, deps }) => {
    if (!deps.spotId) return { spot: null };
    const spots = await queryClient.ensureQueryData(trpcProxy.spots.list.queryOptions());
    return { spot: spots.find((s) => s.id === deps.spotId) ?? null };
  },
  staticData: { panelHeader: 'Upload' },
  component: UploadPanel,
});

function UploadPanel() {
  const { spot: initialSpot } = Route.useLoaderData();
  const { spotId: initialSpotId } = Route.useSearch();
  const navigate = useNavigate();
  const [spot, setSpot] = useState<Spot | null>(initialSpot);

  const handleCancel = () => {
    if (initialSpotId) {
      void navigate({ to: '/$spotId', params: { spotId: initialSpotId } });
    } else {
      void navigate({ to: '/' });
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <FeedSearch
          activeSpot={spot}
          onSpotSelect={setSpot}
          onClear={() => setSpot(null)}
          autoFocus={!spot}
          placeholder={!spot ? 'Where did you shoot?' : undefined}
        />
      </div>
      {spot ? (
        <UploadSidebar spot={spot} onCancel={handleCancel} />
      ) : (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', flex: 1, paddingBottom: 16 }}>
          <button
            onClick={handleCancel}
            style={{
              background: 'none',
              border: 'none',
              color: '#ffaade',
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
              padding: '4px 8px',
              textShadow: '0 0 8px rgba(255,170,222,1), 0 0 24px rgba(255,120,200,0.7)',
            }}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
