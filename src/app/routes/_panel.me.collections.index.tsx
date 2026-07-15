import { createFileRoute, useNavigate } from '@tanstack/react-router';
import {
  SimpleGrid,
  Skeleton,
} from '@mantine/core';
import { useState } from 'react';
import { getErrorMessage } from 'shared/lib/getErrorMessage';
import { notify } from 'shared/lib/notifications';
import { RemoveSessionModal, SurfSessionCard, useStartSessionEdit, type SurfSessionItem } from 'entities/SurfSession';
import { PanelGalleryLayout } from 'shared/ui/PanelGalleryLayout';
import { PanelEmptyState } from 'shared/ui/PanelRouteLayout';
import { BaseGallery } from 'shared/ui/BaseGallery';
import { useCollectionsContext } from './_panel.me.collections';

export const Route = createFileRoute('/_panel/me/collections/')({
  component: UploadsTab,
});

function UploadsTab() {
  const navigate = useNavigate();
  const { sessions, visibleUploads, isLoadingUploads } = useCollectionsContext();
  const { mutateAsync: startSessionEdit, isPending: isOpeningEdit } = useStartSessionEdit();

  const [removingSession, setRemovingSession] = useState<SurfSessionItem | null>(null);

  const handleEdit = async (session: SurfSessionItem) => {
    if (isOpeningEdit) return;
    try {
      const workspace = await startSessionEdit(session.id);
      await navigate({ to: '/upload', search: { workspaceId: workspace.id } });
    } catch (error) {
      notify.error(getErrorMessage(error), 'Unable to Open for Editing');
    }
  };

  if (isLoadingUploads) {
    return (
      <PanelGalleryLayout>
        <SimpleGrid cols={2} spacing="xs">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} height={160} radius="sm" />
          ))}
        </SimpleGrid>
      </PanelGalleryLayout>
    );
  }

  if (sessions.length === 0) {
    return (
      <PanelGalleryLayout>
        <PanelEmptyState
          title="No sessions yet"
          description="Upload your first session to start building your collection."
          actionLabel="Upload"
          onAction={() => void navigate({ to: '/upload' })}
        />
      </PanelGalleryLayout>
    );
  }

  return (
    <PanelGalleryLayout>
      <BaseGallery
        items={visibleUploads}
        aria-label="Uploads"
        renderCard={(session) => (
          <SurfSessionCard
            session={session}
            onClick={(s) =>
              void navigate({
                to: '/$spotId/session/$sessionId',
                params: { spotId: s.spotId, sessionId: s.id },
                search: { from: 'collections' },
              })
            }
            onEdit={(s) => { void handleEdit(s); }}
            onRemove={setRemovingSession}
          />
        )}
      />

      <RemoveSessionModal session={removingSession} onClose={() => setRemovingSession(null)} />
    </PanelGalleryLayout>
  );
}
