import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { motionClasses } from 'shared/ui/design-system';
import { PanelEmptyState, PanelRouteLayout } from 'shared/ui/PanelRouteLayout';
import { useTRPC } from 'shared/lib/trpc';
import { useUser } from 'shared/hooks/useUser';
import { getErrorMessage } from 'shared/lib/getErrorMessage';
import { notify } from 'shared/lib/notifications';
import { FeedSearch } from 'widgets/FeedDrawer';
import { UploadSidebar } from 'features/Upload';
import type { Spot } from 'entities/Spot';
import { useCreateSurfSessionDraft } from 'entities/SurfSession';
import { useAuthModal } from 'entities/Identity';

export const Route = createFileRoute('/_panel/upload')({
  validateSearch: (search): { draftId?: string } => ({
    draftId: typeof search.draftId === 'string' ? search.draftId : undefined,
  }),
  staticData: { panelHeader: 'Upload', panelMode: 'mapInput' },
  component: UploadPanel,
});

function UploadPanel() {
  const { draftId } = Route.useSearch();
  const navigate = useNavigate();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { isAuthenticated, isLoading: isUserLoading } = useUser();
  const { open: openAuthModal } = useAuthModal();
  const { mutateAsync: createDraft, isPending: isCreatingDraft } = useCreateSurfSessionDraft();
  const { data: draft, isError, isLoading: isDraftLoading } = useQuery({
    ...trpc.sessions.draft.queryOptions(draftId ?? ''),
    enabled: isAuthenticated && !!draftId,
  });
  const { mutateAsync: updateDraft } = useMutation(trpc.sessions.updateDraft.mutationOptions());

  const [isSpotFlashing, setIsSpotFlashing] = useState(false);

  const handleSpotChange = useCallback(async (newSpot: Spot | null) => {
    if (!draftId) return;
    await updateDraft({ draftId, spotId: newSpot?.id ?? null });
    await queryClient.invalidateQueries({ queryKey: trpc.sessions.draft.queryKey(draftId) });
  }, [draftId, queryClient, trpc, updateDraft]);

  const handleCancel = () => {
    if (draft?.spotId) {
      void navigate({ to: '/$spotId', params: { spotId: draft.spotId } });
    } else {
      void navigate({ to: '/' });
    }
  };

  const handleStartOrResume = async () => {
    try {
      const nextDraft = await createDraft({});
      await navigate({
        to: '/upload',
        search: { draftId: nextDraft.id },
        replace: true,
      });
    } catch (error) {
      notify.error(getErrorMessage(error), 'Unable to Start Upload');
    }
  };

  if (isUserLoading) return null;
  if (!isAuthenticated) {
    return (
      <UploadEntryState
        title="Sign in to upload"
        description="Uploads are tied to your account so you can manage them later."
        actionLabel="Sign in"
        onAction={openAuthModal}
      />
    );
  }
  if (!draftId) {
    return (
      <UploadEntryState
        title="No upload draft is open"
        description="Start a new upload or resume your current unfinished session."
        actionLabel="Start or resume upload"
        onAction={() => { void handleStartOrResume(); }}
        isPending={isCreatingDraft}
      />
    );
  }
  if (isDraftLoading) return null;
  if (isError || !draft) {
    return (
      <UploadEntryState
        title="This upload draft is unavailable"
        description="It may have been published, removed, or belong to another account."
        actionLabel="Start or resume upload"
        onAction={() => { void handleStartOrResume(); }}
        isPending={isCreatingDraft}
      />
    );
  }

  return (
    <PanelRouteLayout
      header={(
        <FeedSearch
          activeSpot={draft.spot}
          onSpotSelect={(s) => handleSpotChange(s)}
          onClear={() => handleSpotChange(null)}
          autoFocus={!draft.spot}
          placeholder={!draft.spot ? 'Where did you shoot?' : undefined}
        />
      )}
      headerClassName={isSpotFlashing ? motionClasses.flashBorderRounded : undefined}
      onHeaderAnimationEnd={() => setIsSpotFlashing(false)}
    >
      <UploadSidebar
        draft={draft}
        onCancel={handleCancel}
        onPublishFailed={() => setIsSpotFlashing(true)}
      />
    </PanelRouteLayout>
  );
}

function UploadEntryState({
  title,
  description,
  actionLabel,
  onAction,
  isPending = false,
}: {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
  isPending?: boolean;
}) {
  return (
    <PanelEmptyState
      title={title}
      description={description}
      actionLabel={actionLabel}
      pendingLabel="Opening upload…"
      onAction={onAction}
      isPending={isPending}
    />
  );
}
