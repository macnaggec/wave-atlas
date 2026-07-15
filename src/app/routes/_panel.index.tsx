import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { SessionFeed } from 'widgets/SidePanel';
import { usePanelFeedLayoutReadyChange, usePanelFilter, usePanelExpanded } from './_panel';

export const Route = createFileRoute('/_panel/')({
  staticData: { panelHeader: 'Recent Sessions' },
  component: DefaultFeed,
});

function DefaultFeed() {
  const { filters } = usePanelFilter();
  const expanded = usePanelExpanded();
  const onLayoutReadyChange = usePanelFeedLayoutReadyChange();
  const navigate = useNavigate();

  return (
    <SessionFeed
      filters={filters}
      expanded={expanded}
      onLayoutReadyChange={onLayoutReadyChange}
      onSessionClick={(session) =>
        void navigate({ to: '/$spotId/session/$sessionId', params: { spotId: session.spotId, sessionId: session.id } })
      }
    />
  );
}
