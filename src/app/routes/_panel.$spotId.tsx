import { createFileRoute, Outlet } from '@tanstack/react-router';
import { useEffect } from 'react';
import { trpcProxy } from 'app/lib/trpcClient';
import { CartButton } from 'features/Cart/ui/CartButton';
import { useMapStore } from 'widgets/GlobeMap/model/mapStore';

export const Route = createFileRoute('/_panel/$spotId')({
  loader: async ({ params: { spotId }, context: { queryClient } }) => {
    const spots = await queryClient.ensureQueryData(trpcProxy.spots.list.queryOptions());
    const spot = spots.find((s) => s.id === spotId) ?? null;
    return { spot };
  },
  component: SpotLayout,
});

function SpotLayout() {
  const { spotId } = Route.useParams();
  const { spot } = Route.useLoaderData();

  // Route is source of truth for selection. Cleanup fires when navigating away
  // from any /$spotId — the /$spotId unmount is what clears the map highlight.
  useEffect(() => {
    if (spot) useMapStore.getState().setSelection(spot);
    return () => useMapStore.getState().clearSelection();
  }, [spot]);

  return (
    <>
      <Outlet />
      <CartButton spotId={spotId} />
    </>
  );
}
