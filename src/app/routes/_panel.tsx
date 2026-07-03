import { createFileRoute, Outlet, useMatches, useNavigate, useParams, useRouter } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useSelectedSpot, useSpotPreview } from 'entities/Spot';
import { createContext, useCallback, useContext, useLayoutEffect, useState, type ReactNode } from 'react';
import { useTRPC } from 'shared/lib/trpc';
import { setRenderedPanelExpandedSnapshot } from 'shared/model/panelExpansionStore';
import { Loader, Skeleton, Text } from '@mantine/core';
import {
  useCreateSurfSessionDraft,
  type SessionFeedFilter,
  type SurfSessionItem,
} from 'entities/SurfSession';
import { SidePanel } from 'widgets/SidePanel';
import { useCartStore } from 'entities/Commerce';
import { CartDrawerHeader } from 'features/Cart';
import { useUploadStore } from 'features/Upload';
import { ScopeSwitcher } from 'widgets/SidePanel';
import { FeedSearch } from 'widgets/FeedDrawer';
import { FilterPills } from 'widgets/SidePanel';
import {
  FloatingPanelControls,
  PanelRouteActionButton,
  PanelSearchToolbar,
} from 'shared/ui/PanelRouteLayout';
import { formatDateRange } from 'shared/lib/dateUtils';
import { useUser } from 'shared/hooks/useUser';
import { useAuthModal } from 'features/Auth';
import { getErrorMessage } from 'shared/lib/getErrorMessage';
import { notify } from 'shared/lib/notifications';
import { derivePanelTargetPolicy, deriveRenderedPanelState } from './model/panelLayoutPolicy';
import { getPanelRouteMode } from './model/panelRouteMode';

// ─── Contexts — shared with child routes ─────────────────────────────────────

interface PanelFilterCtx {
  activeFilter: SessionFeedFilter;
  setActiveFilter: (f: SessionFeedFilter) => void;
}

const PanelFilterContext = createContext<PanelFilterCtx>({
  activeFilter: null,
  setActiveFilter: () => { },
});

const PanelExpandedContext = createContext(false);
const PanelFeedLayoutReadyContext = createContext<(ready: boolean) => void>(() => { });

export function usePanelFilter() {
  return useContext(PanelFilterContext);
}

export function usePanelExpanded() {
  return useContext(PanelExpandedContext);
}

export function usePanelFeedLayoutReadyChange() {
  return useContext(PanelFeedLayoutReadyContext);
}

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute('/_panel')({
  component: PanelLayout,
});

function PanelLayout() {
  const [activeFilter, setActiveFilter] = useState<SessionFeedFilter>(null);
  return (
    <PanelFilterContext.Provider value={{ activeFilter, setActiveFilter }}>
      <PanelFrame>
        <Outlet />
      </PanelFrame>
    </PanelFilterContext.Provider>
  );
}

function PanelFrame({ children }: { children: ReactNode }) {
  const [userPreferredExpanded, setUserPreferredExpanded] = useState(false);
  const navigate = useNavigate();
  const router = useRouter();
  const matches = useMatches();
  const { activeFilter, setActiveFilter } = usePanelFilter();

  const cartItems = useCartStore((state) => state.items);
  const { isAuthenticated } = useUser();
  const { open: openAuthModal } = useAuthModal();
  const trpc = useTRPC();
  const { data: draftCounts } = useQuery({
    ...trpc.users.myDraftCounts.queryOptions(),
    enabled: isAuthenticated,
  });
  const { mutateAsync: createDraft, isPending: isCreatingDraft } = useCreateSurfSessionDraft();
  const hasDrafts = draftCounts?.hasDrafts ?? false;
  const hasActiveTransfers = useUploadStore((s) => s.transfers.size > 0);

  const cartMatch = matches.find((match) => match.routeId === '/_panel/cart');
  const spotMatch = matches.find((match) => match.routeId === '/_panel/$spotId');
  const uploadMatch = matches.find((match) => match.routeId === '/_panel/upload');
  const uploadDraftId = uploadMatch
    ? (uploadMatch.search as { draftId?: string }).draftId
    : undefined;
  const { data: activeUploadDraft } = useQuery({
    ...trpc.sessions.draft.queryOptions(uploadDraftId ?? ''),
    enabled: isAuthenticated && !!uploadDraftId,
  });
  const galleryMatch = matches.find((match) => match.routeId === '/_panel/$spotId/gallery');
  const sessionDetailMatch = matches.find((match) => match.routeId === '/_panel/$spotId/session/$sessionId');
  const isDefaultIndex = matches.some((match) => match.routeId === '/_panel/');

  const cartFrom = cartMatch
    ? (cartMatch.search as { from?: string }).from
    : undefined;

  const { spotId } = useParams({ strict: false });

  const handleUpload = useCallback(async () => {
    if (!isAuthenticated) {
      openAuthModal();
      return;
    }

    try {
      const startsAt = new Date();
      startsAt.setHours(6, 0, 0, 0);
      const endsAt = new Date(startsAt);
      endsAt.setHours(10, 0, 0, 0);
      const draft = await createDraft({
        spotId: spotId ?? null,
        startsAt,
        endsAt,
      });
      await navigate({ to: '/upload', search: { draftId: draft.id } });
    } catch (error) {
      notify.error(getErrorMessage(error), 'Unable to Start Upload');
    }
  }, [createDraft, isAuthenticated, navigate, openAuthModal, spotId]);

  const { spot: activeSpot } = useSelectedSpot();
  const { data: cartFromSpot } = useSpotPreview(cartFrom ?? '', { enabled: !!cartFrom });

  const panelRouteMode = getPanelRouteMode(matches);
  const routeRequiresExpanded = panelRouteMode === 'workspace';
  const routeRequiresCompactMapInput = panelRouteMode === 'mapInput';
  const panelTargetPolicy = derivePanelTargetPolicy({
    userPreferredExpanded,
    routeMode: panelRouteMode,
  });

  const [isExpanded, setIsExpanded] = useState(() => deriveRenderedPanelState({
    targetExpanded: panelTargetPolicy.expanded,
    targetReason: panelTargetPolicy.reason,
    isFeedLayoutReady: false,
    canWaitForFeedLayout: panelRouteMode === 'browsing',
    currentRenderedExpanded: false,
  }).expanded);
  const [feedLayoutReady, setFeedLayoutReady] = useState(false);
  const handleFeedLayoutReadyChange = useCallback((ready: boolean) => setFeedLayoutReady(ready), []);
  const renderedPanelState = deriveRenderedPanelState({
    targetExpanded: panelTargetPolicy.expanded,
    targetReason: panelTargetPolicy.reason,
    isFeedLayoutReady: feedLayoutReady,
    canWaitForFeedLayout: panelRouteMode === 'browsing',
    currentRenderedExpanded: isExpanded,
  });

  useLayoutEffect(() => {
    if (isExpanded === renderedPanelState.expanded) return;
    const frame = requestAnimationFrame(() => setIsExpanded(renderedPanelState.expanded));
    return () => cancelAnimationFrame(frame);
  }, [isExpanded, renderedPanelState.expanded]);

  useLayoutEffect(() => {
    setRenderedPanelExpandedSnapshot(isExpanded);
  }, [isExpanded]);

  useLayoutEffect(() => {
    return () => setRenderedPanelExpandedSnapshot(false);
  }, []);

  const header: ReactNode = (() => {
    if (cartMatch) {
      return (
        <CartDrawerHeader
          itemCount={cartItems.length}
          spotName={cartFrom && cartFromSpot ? cartFromSpot.name : undefined}
          onBack={
            cartFrom
              ? () => void navigate({ to: '/$spotId', params: { spotId: cartFrom } })
              : () => void navigate({ to: '/' })
          }
        />
      );
    }

    if (sessionDetailMatch) {
      const session = sessionDetailMatch.loaderData as SurfSessionItem | null;
      if (!session) return <Skeleton height={22} width={160} radius="sm" />;
      return (
        <Text size="xs" c="dimmed" truncate>
          {formatDateRange(session.startsAt, session.endsAt)}
        </Text>
      );
    }

    if (spotMatch) {
      return (
        <ScopeSwitcher
          scope={galleryMatch ? 'gallery' : 'sessions'}
          onChange={(scope) => {
            if (scope === 'gallery') void navigate({ to: '/$spotId/gallery', params: { spotId: spotId! } });
            else void navigate({ to: '/$spotId', params: { spotId: spotId! } });
          }}
        />
      );
    }

    for (const match of [...matches].reverse()) {
      const panelHeader = (match.staticData as { panelHeader?: string }).panelHeader;
      if (panelHeader) return <Text fw={600} size="lg">{panelHeader}</Text>;
    }

    return undefined;
  })();

  const subheader: ReactNode = (() => {
    if (sessionDetailMatch || (!spotMatch && !isDefaultIndex)) return undefined;

    return (
      <PanelSearchToolbar
        expanded={isExpanded}
        primary={(
          <FeedSearch
            activeSpot={isDefaultIndex ? null : (activeSpot ?? null)}
            onSpotSelect={isExpanded && isDefaultIndex
              ? (spot) => void navigate({ to: '/$spotId', params: { spotId: spot.id } })
              : undefined}
          />
        )}
        action={(
          <PanelRouteActionButton
            onClick={() => { void handleUpload(); }}
            disabled={isCreatingDraft}
            showIndicator={hasDrafts}
          >
            {hasActiveTransfers ? (
              <>
                <Loader size={10} color="gray" />
                Upload
              </>
            ) : 'Upload'}
          </PanelRouteActionButton>
        )}
        trailing={isExpanded ? (
          <>
            <FilterPills active={activeFilter} onChange={setActiveFilter} />
          </>
        ) : undefined}
      />
    );
  })();

  return (
    <PanelFeedLayoutReadyContext.Provider value={handleFeedLayoutReadyChange}>
      <PanelExpandedContext.Provider value={isExpanded}>
        {/* Compact-mode filter pills — float on the map beside the panel */}
        {(spotMatch || isDefaultIndex) && !isExpanded && (
          <FloatingPanelControls>
            <FilterPills active={activeFilter} onChange={setActiveFilter} />
          </FloatingPanelControls>
        )}
        <SidePanel
          expanded={isExpanded}
          onExpandToggle={
            panelTargetPolicy.canUserToggle
              ? () => setUserPreferredExpanded((prev) => !prev)
              : undefined
          }
          onBack={
            !panelTargetPolicy.usesBackNavigation
              ? undefined
              : routeRequiresCompactMapInput
              ? () => {
                if (activeUploadDraft?.spotId) {
                  void navigate({ to: '/$spotId', params: { spotId: activeUploadDraft.spotId } });
                }
                else void navigate({ to: '/' });
              }
              : routeRequiresExpanded
                ? () => {
                  if (sessionDetailMatch) router.history.back();
                  else if (galleryMatch) void navigate({ to: '/$spotId', params: { spotId: spotId! } });
                  else void navigate({ to: '/' });
                }
                : undefined
          }
          backLabel={sessionDetailMatch || cartMatch ? 'Back to feed' : undefined}
          headerFullWidth={Boolean(cartMatch)}
          header={header}
          subheader={subheader}
        >
          {children}
        </SidePanel>
      </PanelExpandedContext.Provider>
    </PanelFeedLayoutReadyContext.Provider>
  );
}
