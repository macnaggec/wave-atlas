import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { SessionFeed } from 'widgets/SidePanel';
import { usePanelFilter, usePanelExpanded } from './_panel';
import type { SurfSessionItem } from 'entities/SurfSession';

export const Route = createFileRoute('/_panel/$spotId/')({
  component: SpotFeed,
});

function SpotFeed() {
  const { spotId } = Route.useParams();
  const { activeFilter } = usePanelFilter();
  const expanded = usePanelExpanded();
  const navigate = useNavigate();

  return (
    <SessionFeed
      spotId={spotId}
      activeFilter={activeFilter}
      expanded={expanded}
      onSessionClick={(session: SurfSessionItem) =>
        void navigate({ to: '/$spotId/session/$sessionId', params: { spotId, sessionId: session.id } })
      }
    />
  );
}
