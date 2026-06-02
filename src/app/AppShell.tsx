import { Suspense, useState, useCallback, useEffect, useRef } from 'react';
import { Popover, Text } from '@mantine/core';
import { DatePicker } from '@mantine/dates';
import { IconCalendar } from '@tabler/icons-react';
import { GlobeScene } from 'views/GlobeScene';
import { LeftStrip } from 'widgets/LeftStrip/LeftStrip';
import { MyCollection } from 'widgets/SidePanel/MyCollection';
import { SidePanel } from 'widgets/SidePanel';
import { ScopeSwitcher } from 'widgets/SidePanel/ScopeSwitcher';
import { FeedSearch } from 'widgets/FeedDrawer';
import { UploadIndicatorAffix } from 'features/Upload';
import { UploadSidebar } from 'features/Upload/ui/UploadSidebar';
import { SessionFeed } from 'widgets/SidePanel/SessionFeed';
import type { ActiveFilter } from 'widgets/SidePanel/SessionFeed';
import { SessionDetail } from 'widgets/SidePanel/SessionDetail';
import { SpotAllMediaGrid } from 'widgets/SidePanel/SpotAllMediaGrid';
import { useMapStore } from 'widgets/GlobeMap/model/mapStore';
import { mapCommands } from 'widgets/GlobeMap/model/mapCommands';
import { formatDateRange } from 'shared/lib/dateUtils';
import type { Spot } from 'entities/Spot/types';
import type { SurfSessionItem } from 'entities/SurfSession/types';

// ─── Filter pills ─────────────────────────────────────────────────────────────

const PILL: React.CSSProperties = {
  background: 'rgba(255,255,255,0.08)',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
  border: '1px solid rgba(255,255,255,0.18)',
  borderRadius: 20,
  color: 'rgba(255,255,255,0.82)',
  fontSize: 11,
  fontWeight: 500,
  padding: '5px 13px',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  display: 'flex',
  alignItems: 'center',
  gap: 5,
  flexShrink: 0,
};

const PILL_ON: React.CSSProperties = {
  background: 'rgba(255,255,255,0.2)',
  border: '1px solid rgba(255,255,255,0.4)',
  color: '#fff',
};

function FilterPills({ active, onChange }: { active: ActiveFilter; onChange: (f: ActiveFilter) => void }) {
  const [open, setOpen] = useState(false);
  const isCustom = active !== null && typeof active === 'object';
  const customLabel = isCustom
    ? (active as { date: Date }).date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null;

  function pill(label: string, key: Exclude<ActiveFilter, null | { date: Date }>) {
    const on = active === key;
    return (
      <button style={{ ...PILL, ...(on ? PILL_ON : {}) }} onClick={() => onChange(on ? null : key)}>
        {label}
      </button>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {pill('Today', 'today')}
      {pill('Yesterday', 'yesterday')}
      {pill('Last 7 Days', 'last7')}
      <Popover opened={open} onChange={setOpen} position="bottom-start" shadow="md">
        <Popover.Target>
          <button style={{ ...PILL, ...(isCustom ? PILL_ON : {}) }} onClick={() => isCustom ? onChange(null) : setOpen((o) => !o)}>
            {customLabel ?? 'Date'}
            <IconCalendar size={12} />
          </button>
        </Popover.Target>
        <Popover.Dropdown p="xs">
          <DatePicker
            maxDate={new Date()}
            value={isCustom ? (active as { date: Date }).date : null}
            onChange={(d) => {
              setOpen(false);
              if (!d) { onChange(null); return; }
              onChange({ date: typeof d === 'string' ? new Date(d) : d });
            }}
          />
        </Popover.Dropdown>
      </Popover>
    </div>
  );
}

// ─── AppShell ─────────────────────────────────────────────────────────────────

/**
 * AppShell — always-mounted persistent UI layer.
 *
 * Sidebar states:
 *   A — no spot selected: search + session feed
 *   B — spot selected: scope switcher in header, session list
 *   C-all — Gallery tab: all-media grid (expanded)
 *   C-session — session clicked: breadcrumb header, session media grid (expanded)
 */
export function AppShell() {
  const [panelOpen, setPanelOpen] = useState(true);
  const [feedExpanded, setFeedExpanded] = useState(false);
  const [collectionMode, setCollectionMode] = useState(false);
  const [uploadMode, setUploadMode] = useState(false);
  const [uploadSpot, setUploadSpot] = useState<Spot | null>(null);
  const [selectedSession, setSelectedSession] = useState<SurfSessionItem | null>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryScope, setGalleryScope] = useState<'sessions' | 'gallery'>('sessions');
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>(null);
  const prevExpandedRef = useRef(false);

  const selection = useMapStore((s) => s.selection);
  const setSidePanelOpen = useMapStore((s) => s.setSidePanelOpen);

  // Sync visibility to mapStore so map-side code can read it.
  useEffect(() => { setSidePanelOpen(panelOpen); }, [panelOpen, setSidePanelOpen]);

  // Auto-open when a spot is selected (e.g. marker click while tongue is showing).
  useEffect(() => {
    if (selection) setPanelOpen(true);
  }, [selection]);

  // Reset gallery / session when spot is deselected.
  useEffect(() => {
    if (!selection) {
      setGalleryOpen(false);
      setSelectedSession(null);
      setGalleryScope('sessions');
    }
  }, [selection]);

  // ── Derived state ──────────────────────────────────────────────────────────
  const hasSpot = selection != null;
  const isCAll = hasSpot && galleryOpen && selectedSession == null && !uploadMode;
  const isCSession = selectedSession != null && !uploadMode;
  const expanded = feedExpanded;
  const showFilter = !uploadMode && !isCAll && !isCSession && !collectionMode;

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleOpen = useCallback(() => setPanelOpen(true), []);
  const handleClose = useCallback(() => setPanelOpen(false), []);

  const handleOpenCollection = useCallback(() => {
    prevExpandedRef.current = feedExpanded;
    setCollectionMode(true);
    setPanelOpen(true);
    setUploadMode(false);
    setFeedExpanded(true);
  }, [feedExpanded]);

  const handleExpandToggle = useCallback(() => setFeedExpanded((e) => !e), []);

  // When the panel is expanded, selecting a spot via search should update
  // the store filter but not fly the camera — the map is in the background.
  const handleSearchSelectNoFly = useCallback((spot: Spot) => {
    useMapStore.getState().setSelection(spot);
  }, []);

  const handleUploadClick = useCallback(() => {
    setUploadSpot(selection);
    setUploadMode(true);
    setFeedExpanded(false);
    setGalleryOpen(false);
    setSelectedSession(null);
    mapCommands.clearAll();
  }, [selection]);

  const handleUploadSpotSelect = useCallback((spot: Spot) => {
    setUploadSpot(spot);
  }, []);

  const handleUploadSpotClear = useCallback(() => {
    setUploadSpot(null);
  }, []);

  const handleUploadCancel = useCallback(() => {
    setUploadMode(false);
    setUploadSpot(null);
    mapCommands.clearAll();
    setGalleryOpen(false);
    setSelectedSession(null);
    setGalleryScope('sessions');
  }, []);

  const handleSessionClick = useCallback((session: SurfSessionItem) => {
    setSelectedSession(session);
    setGalleryScope('gallery');
    setFeedExpanded(true);
  }, []);

  const handleSeeAll = useCallback(() => {
    setGalleryOpen(true);
    setSelectedSession(null);
    setFeedExpanded(true);
    setGalleryScope('gallery');
  }, []);

  const handleSeeSessions = useCallback(() => {
    setGalleryOpen(false);
    setSelectedSession(null);
    setGalleryScope('sessions');
  }, []);

  const handleScopeChange = useCallback((scope: 'sessions' | 'gallery') => {
    setGalleryScope(scope);
    if (scope === 'gallery') {
      handleSeeAll();
    } else {
      handleSeeSessions();
    }
  }, [handleSeeAll, handleSeeSessions]);

  // ── SidePanel props ────────────────────────────────────────────────────────

  // Tongue label: spot name when a spot is active, mode label otherwise.
  const tongueLabel = collectionMode ? 'Collection' : uploadMode ? 'Upload' : (selection?.name ?? 'Feed');

  return (
    <>
      <div inert={expanded || undefined}>
        <GlobeScene />
      </div>
      <Suspense>
        <UploadIndicatorAffix />
      </Suspense>

      <LeftStrip onOpenCollection={handleOpenCollection} />

      {/* Compact-mode filter pills — float on the map right beside the sidebar */}
      {showFilter && !expanded && panelOpen && (
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
        isOpen={panelOpen}
        onOpen={handleOpen}
        onClose={handleClose}
        expanded={expanded}
        onBack={collectionMode ? () => { setCollectionMode(false); setFeedExpanded(prevExpandedRef.current); } : undefined}
        onExpandToggle={!collectionMode && !uploadMode && !isCAll && !isCSession ? handleExpandToggle : undefined}
        tongueLabel={tongueLabel}
        header={
          collectionMode
            ? <Text size="sm" fw={500} c="dimmed">My Collection</Text>
            : uploadMode
            ? <Text size="sm" fw={500} c="dimmed">Upload</Text>
            : isCSession && selectedSession
            ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, overflow: 'hidden' }}>
                <button
                  onClick={handleSeeSessions}
                  style={{ background: 'none', border: 'none', color: '#63b3ed', fontSize: 12, cursor: 'pointer', padding: 0, flexShrink: 0 }}
                >
                  Sessions
                </button>
                <span style={{ color: 'rgba(255,255,255,0.35)', flexShrink: 0 }}>›</span>
                <Text size="xs" c="dimmed" truncate>
                  {formatDateRange(selectedSession.startsAt, selectedSession.endsAt)}
                </Text>
              </div>
            )
            : hasSpot
            ? <ScopeSwitcher scope={galleryScope} onChange={handleScopeChange} />
            : <Text size="sm" fw={500} c="dimmed">Recent Sessions</Text>
        }
        subheader={
          collectionMode
            ? undefined
            : uploadMode
            ? <FeedSearch
                autoFocus={!uploadSpot}
                placeholder={!uploadSpot ? 'Where did you shoot?' : undefined}
                activeSpot={uploadSpot}
                onSpotSelect={handleUploadSpotSelect}
                onClear={handleUploadSpotClear}
              />
            : !isCSession
            ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* Search + Upload — pinned at 25vw when expanded so filter pills can fill the rest */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  ...(expanded ? { width: '25vw', flexShrink: 0 } : { flex: 1, minWidth: 0 }),
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <FeedSearch onSpotSelect={expanded ? handleSearchSelectNoFly : undefined} />
                  </div>
                  <button
                    onClick={handleUploadClick}
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
                {/* Filter pills — far-right opposite the search bar */}
                {showFilter && expanded && (
                  <div style={{ marginLeft: 'auto' }}>
                    <FilterPills active={activeFilter} onChange={setActiveFilter} />
                  </div>
                )}
              </div>
            )
            : undefined
        }
      >
        {/* Collection mode */}
        {collectionMode && <MyCollection />}

        {/* Upload mode */}
        <div style={{ display: !collectionMode && uploadMode ? 'flex' : 'none', flex: 1, flexDirection: 'column', minHeight: 0 }}>
          {uploadSpot
            ? <UploadSidebar active={uploadMode} spot={uploadSpot} onCancel={handleUploadCancel} />
            : (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', flex: 1, paddingBottom: 16 }}>
                <button
                  onClick={handleUploadCancel}
                  style={{ background: 'none', border: 'none', color: '#ffaade', fontSize: 14, fontWeight: 500, cursor: 'pointer', padding: '4px 8px', textShadow: '0 0 8px rgba(255,170,222,1), 0 0 24px rgba(255,120,200,0.7)' }}
                >
                  Cancel
                </button>
              </div>
            )
          }
        </div>

        {/* Browse states */}
        <div style={{ display: !collectionMode && !uploadMode ? 'flex' : 'none', flex: 1, flexDirection: 'column', minHeight: 0 }}>
          {/* State A + State B: session list */}
          {!isCAll && !isCSession && (
            <SessionFeed expanded={feedExpanded} activeFilter={activeFilter} onSessionClick={handleSessionClick} />
          )}

          {/* State C-all: all-media grid with filter bar */}
          {isCAll && selection && (
            <SpotAllMediaGrid spotId={selection.id} />
          )}

          {/* State C-session: single-session media grid */}
          {isCSession && selectedSession && (
            <SessionDetail session={selectedSession} />
          )}
        </div>
      </SidePanel>
    </>
  );
}
