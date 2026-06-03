import { createFileRoute } from '@tanstack/react-router';
import { trpcProxy } from 'app/lib/trpcClient';
import { SessionDetail } from 'widgets/SidePanel/SessionDetail';

export const Route = createFileRoute('/_panel/$spotId/session/$sessionId')({
  loader: async ({ context: { queryClient }, params }) =>
    queryClient.ensureQueryData(trpcProxy.sessions.byId.queryOptions(params.sessionId)),
  staticData: { forceExpanded: true },
  component: SessionDetailPage,
});

function SessionDetailPage() {
  const session = Route.useLoaderData();
  if (!session) return null;
  return <SessionDetail session={session} />;
}
