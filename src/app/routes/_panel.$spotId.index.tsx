import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { SessionFeed } from 'widgets/SidePanel';
import { usePanelFeedLayoutReadyChange, usePanelFilter, usePanelExpanded } from './_panel';

export const Route = createFileRoute('/_panel/$spotId/')({
  component: SpotFeed,
});

function SpotFeed() {
  const { spotId } = Route.useParams();
  const { activeFilter } = usePanelFilter();
  const expanded = usePanelExpanded();
  const onLayoutReadyChange = usePanelFeedLayoutReadyChange();
  const navigate = useNavigate();

  return (
    <SessionFeed
      spotId={spotId}
      activeFilter={activeFilter}
      expanded={expanded}
      onLayoutReadyChange={onLayoutReadyChange}
      onSessionClick={(session) =>
        void navigate({ to: '/$spotId/session/$sessionId', params: { spotId, sessionId: session.id } })
      }
    />
  );
}
