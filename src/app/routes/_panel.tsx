import { createFileRoute, Outlet, useMatches, useNavigate, useParams } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useSelectedSpot, useSpotPreview } from 'entities/Spot';
import { createContext, useCallback, useContext, useLayoutEffect, useState, type ReactNode } from 'react';
import { useTRPC } from 'shared/lib/trpc';
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
import { formatDateRange } from 'shared/lib/dateUtils';
import { useUser } from 'shared/hooks/useUser';
import { useAuthModal } from 'features/Auth';
import { getErrorMessage } from 'shared/lib/getErrorMessage';
import { notify } from 'shared/lib/notifications';

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
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();
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

  const forceExpanded = matches.some(
    (match) => !!(match.staticData as { forceExpanded?: boolean }).forceExpanded,
  );

  const targetExpanded = forceExpanded || (expanded && !uploadMatch);
  const [isExpanded, setIsExpanded] = useState(targetExpanded);
  const [feedLayoutReady, setFeedLayoutReady] = useState(false);
  const handleFeedLayoutReadyChange = useCallback((ready: boolean) => setFeedLayoutReady(ready), []);

  useLayoutEffect(() => {
    if (isExpanded === targetExpanded) return;
    if (!targetExpanded && !feedLayoutReady) return;
    const frame = requestAnimationFrame(() => setIsExpanded(targetExpanded));
    return () => cancelAnimationFrame(frame);
  }, [feedLayoutReady, isExpanded, targetExpanded]);

  const header: ReactNode = (() => {
    if (cartMatch) {
      return (
        <CartDrawerHeader
          itemCount={cartItems.length}
          spotName={cartFrom && cartFromSpot ? cartFromSpot.name : undefined}
          onBack={
            cartFrom
              ? () => void navigate({ to: '/$spotId', params: { spotId: cartFrom } })
              : undefined
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          ...(isExpanded ? { width: '25vw', flexShrink: 0 } : { flex: 1, minWidth: 0 }),
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <FeedSearch
              activeSpot={isDefaultIndex ? null : (activeSpot ?? null)}
              onSpotSelect={isExpanded && isDefaultIndex
                ? (spot) => void navigate({ to: '/$spotId', params: { spotId: spot.id } })
                : undefined}
            />
          </div>
          <button
            onClick={() => { void handleUpload(); }}
            disabled={isCreatingDraft}
            style={{
              position: 'relative',
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 20,
              color: 'rgba(255,255,255,0.85)',
              fontSize: 11,
              padding: '3px 10px',
              cursor: isCreatingDraft ? 'default' : 'pointer',
              flexShrink: 0,
              whiteSpace: 'nowrap',
            }}
          >
            {hasActiveTransfers ? (
              <>
                <Loader size={10} color="gray" style={{ marginRight: 4, verticalAlign: 'middle' }} />
                Upload
              </>
            ) : 'Upload'}
            {hasDrafts && (
              <span style={{
                position: 'absolute',
                top: -3,
                right: -3,
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#ffaade',
                boxShadow: '0 0 6px rgba(255,170,222,0.8)',
              }} />
            )}
          </button>
        </div>
        {isExpanded && (
          <div style={{ marginLeft: 'auto' }}>
            <FilterPills active={activeFilter} onChange={setActiveFilter} />
          </div>
        )}
      </div>
    );
  })();

  return (
    <PanelFeedLayoutReadyContext.Provider value={handleFeedLayoutReadyChange}>
      <PanelExpandedContext.Provider value={isExpanded}>
        {/* Compact-mode filter pills — float on the map beside the panel */}
        {(spotMatch || isDefaultIndex) && !isExpanded && (
          <div style={{
            position: 'fixed',
            top: 14,
            right: 'calc(25vw + 8px)',
            zIndex: 150,
            display: 'flex',
            gap: 6,
            alignItems: 'center',
          }}>
            <FilterPills active={activeFilter} onChange={setActiveFilter} />
          </div>
        )}
        <SidePanel
          expanded={isExpanded}
          onExpandToggle={forceExpanded || uploadMatch ? undefined : () => setExpanded((prev) => !prev)}
          onBack={
            uploadMatch
              ? () => {
                if (activeUploadDraft?.spotId) {
                  void navigate({ to: '/$spotId', params: { spotId: activeUploadDraft.spotId } });
                }
                else void navigate({ to: '/' });
              }
              : forceExpanded
                ? () => {
                  if (sessionDetailMatch) void navigate({ to: '/$spotId', params: { spotId: spotId! } });
                  else if (galleryMatch) void navigate({ to: '/$spotId', params: { spotId: spotId! } });
                  else void navigate({ to: '/' });
                }
                : undefined
          }
          backLabel={sessionDetailMatch ? 'Back to feed' : undefined}
          header={header}
          subheader={subheader}
        >
          {children}
        </SidePanel>
      </PanelExpandedContext.Provider>
    </PanelFeedLayoutReadyContext.Provider>
  );
}
