import { createFileRoute } from '@tanstack/react-router';
import { Center, Loader } from '@mantine/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PanelGalleryLayout } from 'shared/ui/PanelGalleryLayout';
import { useTRPC } from 'shared/lib/trpc';
import { notify } from 'shared/lib/notifications';
import { getErrorMessage } from 'shared/lib/getErrorMessage';
import { EarningsPanel } from 'features/Ledger';

export const Route = createFileRoute('/_panel/me/earnings')({
  staticData: { panelHeader: 'Earnings', panelMode: 'workspace' },
  component: EarningsRoute,
});

function EarningsRoute() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: summary, isLoading } = useQuery(trpc.ledger.summary.queryOptions());
  const { mutateAsync: requestPayout, isPending: isRequestingPayout } = useMutation(
    trpc.ledger.requestPayout.mutationOptions(),
  );

  if (isLoading || !summary) {
    return (
      <PanelGalleryLayout>
        <Center mih={200}>
          <Loader size="sm" />
        </Center>
      </PanelGalleryLayout>
    );
  }

  const handleRequestPayout = async () => {
    try {
      await requestPayout();
      await queryClient.invalidateQueries({ queryKey: trpc.ledger.summary.queryKey() });
      notify.success('Your payout request was created.', 'Payout Requested');
    } catch (error) {
      notify.error(getErrorMessage(error), 'Payout Request Failed');
    }
  };

  return (
    <PanelGalleryLayout>
      <EarningsPanel
        summary={summary}
        isRequestingPayout={isRequestingPayout}
        onRequestPayout={() => { void handleRequestPayout(); }}
      />
    </PanelGalleryLayout>
  );
}
