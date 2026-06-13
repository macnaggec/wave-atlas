import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { trpcProxy } from 'app/lib/trpcClient';
import { useTRPC } from 'app/lib/trpc';
import { FeedSearch } from 'widgets/FeedDrawer';
import { UploadSidebar } from 'features/Upload/ui/UploadSidebar';
import { useUploadStore } from 'features/Upload/model';
import { useUpdateBatchMedia } from 'entities/Media';
import type { Spot } from 'entities/Spot';

export const Route = createFileRoute('/_panel/upload')({
  validateSearch: (search): { spotId?: string } => ({
    spotId: typeof search.spotId === 'string' ? search.spotId : undefined,
  }),
  loaderDeps: ({ search }) => ({ spotId: search.spotId }),
  loader: async ({ context: { queryClient }, deps }) => {
    if (!deps.spotId) return { spot: null };
    try {
      const spot = await queryClient.ensureQueryData(trpcProxy.spots.byId.queryOptions(deps.spotId));
      return { spot: spot ?? null };
    } catch {
      return { spot: null };
    }
  },
  staticData: { panelHeader: 'Upload' },
  component: UploadPanel,
});

function UploadPanel() {
  const { spot: initialSpot } = Route.useLoaderData();
  const { spotId: initialSpotId } = Route.useSearch();
  const navigate = useNavigate();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { mutateAsync: updateBatch } = useUpdateBatchMedia();

  const [spot, setSpot] = useState<Spot | null>(initialSpot);

  const uploadQueue = useUploadStore((s) => s.uploadQueue);
  const setUploadSpotId = useUploadStore((s) => s.setUploadSpotId);
  const updateItem = useUploadStore((s) => s.updateItem);

  const hasDrafts = uploadQueue.some(i => i.status !== 'cancelled');
  const missingSpot = !spot && hasDrafts;

  const handleSpotSelect = useCallback(async (newSpot: Spot) => {
    if (spot && spot.id !== newSpot.id) {
      const mediaIds = uploadQueue
        .filter((item) => item.mediaId)
        .map((item) => item.mediaId!);

      if (mediaIds.length > 0) {
        await updateBatch({ mediaIds, spotId: newSpot.id });
        // Update Zustand items so useUploadQueue finds them under the new spotId
        uploadQueue
          .filter((item) => item.mediaId)
          .forEach((item) => updateItem(item.id, { spotId: newSpot.id }));
        void queryClient.invalidateQueries({ queryKey: trpc.media.sessionlessDrafts.queryKey() });
      }
    }
    setUploadSpotId(newSpot.id);
    setSpot(newSpot);
  }, [spot, uploadQueue, updateBatch, updateItem, setUploadSpotId, queryClient, trpc]);

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
        <div style={missingSpot ? {
          borderRadius: 8,
          boxShadow: '0 0 0 1.5px #ff4d6d, 0 0 8px rgba(255,77,109,0.45)',
        } : undefined}>
          <FeedSearch
            activeSpot={spot}
            onSpotSelect={handleSpotSelect}
            onClear={() => setSpot(null)}
            autoFocus={!spot}
            placeholder={!spot ? 'Where did you shoot?' : undefined}
          />
        </div>
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
