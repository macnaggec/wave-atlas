import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './_panel.upload.module.css';
import { trpcProxy } from 'shared/lib/trpcClient';
import { FeedSearch } from 'widgets/FeedDrawer';
import { UploadSidebar } from 'features/Upload';
import { useUploadStore } from 'features/Upload';
import type { Spot } from 'entities/Spot';
import { mapCommands } from 'widgets/GlobeMap';

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

  const [spot, setSpot] = useState<Spot | null>(initialSpot);
  const [spotErrorTick, setSpotErrorTick] = useState(0);
  const [isSpotFlashing, setIsSpotFlashing] = useState(false);
  const prevSpotTickRef = useRef(0);

  const setUploadSpotId = useUploadStore((s) => s.setUploadSpotId);

  useEffect(() => {
    if (spotErrorTick > 0 && spotErrorTick !== prevSpotTickRef.current) {
      prevSpotTickRef.current = spotErrorTick;
      setIsSpotFlashing(true);
    }
  }, [spotErrorTick]);

  const handleSpotChange = useCallback((newSpot: Spot | null) => {
    setSpot(newSpot);
    setUploadSpotId(newSpot?.id ?? null);
  }, [setUploadSpotId]);

  useEffect(() => {
    mapCommands.setUploadSpotHandler(handleSpotChange);
    return () => mapCommands.setUploadSpotHandler(null);
  }, [handleSpotChange]);

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
        <div
          className={isSpotFlashing ? styles.flashBorder : undefined}
          onAnimationEnd={() => setIsSpotFlashing(false)}
        >
          <FeedSearch
            activeSpot={spot}
            onSpotSelect={(s) => handleSpotChange(s)}
            onClear={() => handleSpotChange(null)}
            autoFocus={!spot}
            placeholder={!spot ? 'Where did you shoot?' : undefined}
          />
        </div>
      </div>
      <UploadSidebar
        spot={spot}
        onCancel={handleCancel}
        onPublishFailed={() => setSpotErrorTick(t => t + 1)}
      />
    </div>
  );
}
