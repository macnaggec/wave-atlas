import { createFileRoute, Outlet } from '@tanstack/react-router';
import { trpcProxy } from 'app/lib/trpcClient';

export const Route = createFileRoute('/_panel/$spotId')({
  loader: async ({ context: { queryClient } }) => {
    await queryClient.ensureQueryData(trpcProxy.spots.list.queryOptions());
  },
  component: () => <Outlet />,
});
