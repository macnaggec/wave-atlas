import { createFileRoute, Outlet } from '@tanstack/react-router';
import { trpcProxy } from 'app/lib/trpcClient';
import { CartButton } from 'features/Cart/ui/CartButton';

export const Route = createFileRoute('/_panel/$spotId')({
  loader: async ({ params: { spotId }, context: { queryClient } }) => {
    const spots = await queryClient.ensureQueryData(trpcProxy.spots.list.queryOptions());
    const spot = spots.find((s) => s.id === spotId);
    return { spotName: spot?.name ?? null };
  },
  component: SpotLayout,
});

function SpotLayout() {
  const { spotId } = Route.useParams();
  return (
    <>
      <Outlet />
      <CartButton spotId={spotId} />
    </>
  );
}
