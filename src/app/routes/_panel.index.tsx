import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { SessionFeed } from 'widgets/SidePanel';
import { usePanelFilter, usePanelExpanded } from './_panel';
import type { SurfSessionItem } from 'entities/SurfSession';

export const Route = createFileRoute('/_panel/')({
  staticData: { panelHeader: 'Recent Sessions' },
  component: DefaultFeed,
});

function DefaultFeed() {
  const { activeFilter } = usePanelFilter();
  const expanded = usePanelExpanded();
  const navigate = useNavigate();

  return (
    <SessionFeed
      activeFilter={activeFilter}
      expanded={expanded}
      onSessionClick={(session: SurfSessionItem) =>
        void navigate({ to: '/$spotId/session/$sessionId', params: { spotId: session.spotId, sessionId: session.id } })
      }
    />
  );
}
