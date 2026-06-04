import { createFileRoute, Outlet, useMatches, useNavigate, useParams, useRouter } from '@tanstack/react-router';
import { useSelectedSpot } from 'entities/Spot/model/useSelectedSpot';
import { createContext, useContext, useState, type ReactNode } from 'react';
import { Skeleton, Text } from '@mantine/core';
import type { SurfSessionItem } from 'entities/SurfSession/types';
import { SidePanel } from 'widgets/SidePanel';
import { useCartStore } from 'features/Cart/model/cartStore';
import { useSpotPreview } from 'entities/Spot/model/useSpotPreview';
import { CartDrawerHeader } from 'features/Cart/ui/CartDrawerHeader';
import { ScopeSwitcher } from 'widgets/SidePanel/ScopeSwitcher';
import { FeedSearch } from 'widgets/FeedDrawer';
import { FilterPills } from 'widgets/SidePanel/FilterPills';
import type { ActiveFilter } from 'widgets/SidePanel/SessionFeed';
import { formatDateRange } from 'shared/lib/dateUtils';

// ─── Contexts — shared with child routes ─────────────────────────────────────

interface PanelFilterCtx {
  activeFilter: ActiveFilter;
  setActiveFilter: (f: ActiveFilter) => void;
}

const PanelFilterContext = createContext<PanelFilterCtx>({
  activeFilter: null,
  setActiveFilter: () => {},
});

const PanelExpandedContext = createContext(false);

export function usePanelFilter() {
  return useContext(PanelFilterContext);
}

export function usePanelExpanded() {
  return useContext(PanelExpandedContext);
}

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute('/_panel')({
  component: PanelLayout,
});

function PanelLayout() {
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>(null);
  return (
    <PanelFilterContext.Provider value={{ activeFilter, setActiveFilter }}>
      <PanelFrame>
        <Outlet />
      </PanelFrame>
    </PanelFilterContext.Provider>
  );
}

function PanelFrame({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();
  const router = useRouter();
  const matches = useMatches();
  const { activeFilter, setActiveFilter } = usePanelFilter();

  const cartItems = useCartStore((state) => state.items);

  const cartMatch = matches.find((match) => match.routeId === '/_panel/cart');
  const spotMatch = matches.find((match) => match.routeId === '/_panel/$spotId');
  const uploadMatch = matches.find((match) => match.routeId === '/_panel/upload');
  const galleryMatch = matches.find((match) => match.routeId === '/_panel/$spotId/gallery');
  const sessionDetailMatch = matches.find((match) => match.routeId === '/_panel/$spotId/session/$sessionId');
  const isDefaultIndex = matches.some((match) => match.routeId === '/_panel/');

  const cartFrom = cartMatch
    ? (cartMatch.search as { from?: string }).from
    : undefined;

  const { spotId } = useParams({ strict: false });

  const { spot: activeSpot } = useSelectedSpot();
  const { data: cartFromSpot } = useSpotPreview(cartFrom ?? '');

  const forceExpanded = matches.some(
    (match) => !!(match.staticData as { forceExpanded?: boolean }).forceExpanded,
  );

  const isExpanded = forceExpanded || (expanded && !uploadMatch);

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, overflow: 'hidden' }}>
          <button
            onClick={() => router.history.back()}
            style={{ background: 'none', border: 'none', color: '#63b3ed', fontSize: 12, cursor: 'pointer', padding: 0, flexShrink: 0 }}
          >
            Sessions
          </button>
          <span style={{ color: 'rgba(255,255,255,0.35)', flexShrink: 0 }}>›</span>
          <Text size="xs" c="dimmed" truncate>
            {formatDateRange(session.startsAt, session.endsAt)}
          </Text>
        </div>
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
            onClick={() => void navigate(spotId
              ? { to: '/upload', search: { spotId } }
              : { to: '/upload' }
            )}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 20,
              color: 'rgba(255,255,255,0.85)',
              fontSize: 11,
              padding: '3px 10px',
              cursor: 'pointer',
              flexShrink: 0,
              whiteSpace: 'nowrap',
            }}
          >
            Upload
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
    <PanelExpandedContext.Provider value={isExpanded}>
      {/* Compact-mode filter pills — float on the map beside the panel */}
      {(spotMatch || isDefaultIndex) && !isExpanded && isOpen && (
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
        isOpen={isOpen}
        onOpen={() => setIsOpen(true)}
        onClose={() => setIsOpen(false)}
        expanded={isExpanded}
        onExpandToggle={forceExpanded || uploadMatch ? undefined : () => setExpanded((prev) => !prev)}
        onBack={
          forceExpanded
            ? () => {
                if (sessionDetailMatch) router.history.back();
                else if (galleryMatch) void navigate({ to: '/$spotId', params: { spotId: spotId! } });
                else void navigate({ to: '/' });
              }
            : undefined
        }
        header={header}
        subheader={subheader}
      >
        {children}
      </SidePanel>
    </PanelExpandedContext.Provider>
  );
}
