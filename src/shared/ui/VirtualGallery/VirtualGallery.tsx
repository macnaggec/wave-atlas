import React, { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useScrollHidden } from 'shared/hooks';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Loader, Text } from '@mantine/core';
import { IconChevronLeft, IconClock } from '@tabler/icons-react';
import type { GalleryRow } from 'shared/lib/buildGalleryRows';
// eslint-disable-next-line boundaries/dependencies -- F3: Gallery primitive work will remove domain type dependency
import type { MediaItem } from 'entities/Media/types';
import type { CardContext } from 'shared/ui/BaseGallery/BaseGallery';
import SelectionCheckbox from 'shared/ui/BaseGallery/SelectionCheckbox';
import styles from './VirtualGallery.module.css';

const DIVIDER_HEIGHT = 48;
const HOUR_DIVIDER_HEIGHT = 36;
const CARD_ROW_ESTIMATE = 220;

/** Minimal selection interface VirtualGallery needs — avoids generic parameter. */
interface SelectionState {
  isSelectionMode: boolean;
  isSelected: (id: string) => boolean;
  toggle: (id: string) => void;
}

export interface VirtualGalleryProps {
  rows: GalleryRow[];
  renderCard: (item: MediaItem, context: CardContext) => ReactNode;
  selection?: SelectionState;
  /** Optional toolbar rendered sticky at the top of the scroll container. */
  toolbar?: ReactNode;
  /** Date → row index pairs for the fast-scroll sidebar. */
  highlights: { date: Date; rowIndex: number }[];
  /** Currently expanded date for hour drill-down (null = date mode). */
  expandedDate?: Date | null;
  /** Called when user clicks a drillable date divider or the back button. */
  onDateExpand?: (date: Date | null) => void;
  onEndReached?: () => void;
  isFetchingMore?: boolean;
}

export function VirtualGallery({
  rows,
  renderCard,
  selection,
  toolbar,
  highlights,
  expandedDate,
  onDateExpand,
  onEndReached,
  isFetchingMore,
}: VirtualGalleryProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  useScrollHidden(toolbarRef, selection?.isSelectionMode ?? false);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => containerRef.current,
    estimateSize: (i) => {
      const row = rows[i];
      if (row?.type === 'divider') return DIVIDER_HEIGHT;
      if (row?.type === 'hour-divider') return HOUR_DIVIDER_HEIGHT;
      return CARD_ROW_ESTIMATE;
    },
    measureElement: (el) => el.getBoundingClientRect().height,
    overscan: 3,
  });

  // Map item id → global index for CardContext
  const itemIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    let idx = 0;
    rows.forEach((row) => {
      if (row.type === 'media') row.items.forEach((item) => map.set(item.id, idx++));
    });
    return map;
  }, [rows]);

  const totalItems = itemIndexMap.size;

  const virtualItems = virtualizer.getVirtualItems();
  const lastIndex = virtualItems[virtualItems.length - 1]?.index ?? -1;

  // Fetch next page when approaching the last row
  useEffect(() => {
    if (lastIndex >= rows.length - 3) onEndReached?.();
  }, [lastIndex, rows.length, onEndReached]);

  // Track scroll position to find the true first visible row (free of overscan bias)
  const [scrollTop, setScrollTop] = useState(0);
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onScroll = () => setScrollTop(container.scrollTop);
    container.addEventListener('scroll', onScroll, { passive: true });
    return () => container.removeEventListener('scroll', onScroll);
  }, []);

  // First row whose bottom edge is past the scroll position = actually visible
  const firstVisibleIndex = useMemo(
    () => virtualItems.find((vi) => vi.start + vi.size > scrollTop)?.index ?? 0,
    [virtualItems, scrollTop],
  );

  // Active highlight = last divider at or before the first visible row
  const activeHighlightIndex = useMemo(() => {
    let active = 0;
    for (let i = 0; i < highlights.length; i++) {
      if (highlights[i]!.rowIndex <= firstVisibleIndex) active = i;
      else break;
    }
    return active;
  }, [firstVisibleIndex, highlights]);

  // ---- HOUR DRILL-DOWN SIDEBAR ----

  // Derive hour highlights from rows when in expanded mode
  const hourHighlights = useMemo(() => {
    if (!expandedDate) return null;
    const result: { hour: number; rowIndex: number }[] = [];
    rows.forEach((row, i) => {
      if (row.type === 'hour-divider') result.push({ hour: row.hour, rowIndex: i });
    });
    return result.length > 0 ? result : null;
  }, [rows, expandedDate]);

  // Active hour index (when in drill-down mode)
  const activeHourIndex = useMemo(() => {
    if (!hourHighlights) return -1;
    let active = 0;
    for (let i = 0; i < hourHighlights.length; i++) {
      if (hourHighlights[i]!.rowIndex <= firstVisibleIndex) active = i;
      else break;
    }
    return active;
  }, [firstVisibleIndex, hourHighlights]);

  // ---- DATE SIDEBAR ----

  // Collapse sidebar to month granularity when there are too many dates to fit
  const SIDEBAR_MAX = 12;
  const useMonths = !expandedDate && highlights.length > SIDEBAR_MAX;

  const sidebarGroups = useMemo(() => {
    if (!useMonths) return highlights.map((h, i) => ({ ...h, originalIndex: i }));
    const seen = new Set<string>();
    return highlights
      .map((h, i) => ({ ...h, originalIndex: i }))
      .filter(({ date }) => {
        const key = `${date.getFullYear()}-${date.getMonth()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }, [highlights, useMonths]);

  // When collapsed to months, find which month group contains the active highlight
  const activeSidebarIndex = useMemo(() => {
    if (!useMonths) return activeHighlightIndex;
    let active = 0;
    const activeRowIndex = highlights[activeHighlightIndex]?.rowIndex ?? 0;
    for (let i = 0; i < sidebarGroups.length; i++) {
      if (sidebarGroups[i]!.rowIndex <= activeRowIndex) active = i;
      else break;
    }
    return active;
  }, [useMonths, sidebarGroups, activeHighlightIndex, highlights]);

  // Keep the active sidebar button scrolled into view
  const activeBtnRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    activeBtnRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeSidebarIndex, activeHourIndex]);

  const handleItemClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const itemId = e.currentTarget.getAttribute('data-item-id');
      if (itemId && selection?.isSelectionMode) selection.toggle(itemId);
    },
    [selection],
  );

  // A date divider is drillable if its content height exceeds the container height
  const isDrillable = useCallback(
    (mediaRowCount: number) => {
      const containerHeight = containerRef.current?.clientHeight ?? 0;
      return !!onDateExpand && mediaRowCount * CARD_ROW_ESTIMATE > containerHeight;
    },
    [onDateExpand],
  );

  const formatHour = (hour: number) => {
    const d = new Date(Date.UTC(2000, 0, 1, hour, 0, 0));
    return d.toLocaleTimeString(undefined, { hour: 'numeric', hour12: true, timeZone: 'UTC' });
  };

  return (
    <div className={styles.wrapper}>
      {/* Virtualizer scroll container */}
      <div ref={containerRef} className={styles.container}>
        {toolbar && (
          <div ref={toolbarRef} className={styles.toolbar}>
            {toolbar}
          </div>
        )}
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualItems.map((virtualItem) => {
            const row = rows[virtualItem.index];
            if (!row) return null;

            return (
              <div
                key={virtualItem.key}
                data-index={virtualItem.index}
                ref={virtualizer.measureElement}
                style={{ position: 'absolute', top: virtualItem.start, left: 0, width: '100%' }}
              >
                {row.type === 'divider' ? (
                  <div
                    className={`${styles.divider} ${isDrillable(row.mediaRowCount) ? styles.dividerDrillable : ''}`}
                    onClick={isDrillable(row.mediaRowCount) ? () => onDateExpand?.(row.date) : undefined}
                  >
                    <Text size="sm" fw={600} c="dimmed">
                      {row.date.toLocaleDateString(undefined, {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </Text>
                    {isDrillable(row.mediaRowCount) && (
                      <IconClock size={14} style={{ marginLeft: 6, opacity: 0.5, flexShrink: 0 }} />
                    )}
                  </div>
                ) : row.type === 'hour-divider' ? (
                  <div className={styles.hourDivider}>
                    <Text size="xs" fw={500} c="dimmed">
                      {formatHour(row.hour)}
                    </Text>
                  </div>
                ) : (
                  <div className={styles.mediaRow}>
                    {row.items.map((item) => {
                      const globalIndex = itemIndexMap.get(item.id) ?? 0;
                      const isSelected = selection?.isSelected(item.id) ?? false;
                      const showCheckbox = selection?.isSelectionMode ?? false;

                      return (
                        <div
                          key={item.id}
                          className={styles.cardWrapper}
                          data-item-id={item.id}
                          data-selectable={showCheckbox}
                          onClick={showCheckbox ? handleItemClick : undefined}
                        >
                          {renderCard(item, {
                            index: globalIndex,
                            isFirst: globalIndex === 0,
                            isLast: globalIndex === totalItems - 1,
                            isSelectionMode: showCheckbox,
                          })}
                          {showCheckbox && <SelectionCheckbox checked={isSelected} />}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {isFetchingMore && (
          <div className={styles.loader}>
            <Loader size="sm" />
          </div>
        )}
      </div>

      {/* Fast-scroll sidebar — hour mode or date mode */}
      {hourHighlights ? (
        <nav className={styles.sidebar} aria-label="Jump to hour">
          <button
            className={styles.sidebarBackBtn}
            onClick={() => onDateExpand?.(null)}
            title="Back to date view"
          >
            <IconChevronLeft size={14} />
          </button>
          {hourHighlights.map(({ hour, rowIndex }, i) => {
            const isActive = i === activeHourIndex;
            return (
              <button
                key={hour}
                ref={isActive ? activeBtnRef : undefined}
                className={`${styles.sidebarBtn} ${isActive ? styles.sidebarBtnActive : ''}`}
                onClick={() => virtualizer.scrollToIndex(rowIndex, { align: 'start' })}
                title={formatHour(hour)}
              >
                <span className={styles.sidebarHour}>{hour.toString().padStart(2, '0')}</span>
              </button>
            );
          })}
        </nav>
      ) : sidebarGroups.length > 0 ? (
        <nav className={styles.sidebar} aria-label="Jump to date">
          {sidebarGroups.map(({ date, rowIndex }, i) => {
            const isActive = i === activeSidebarIndex;
            const prevDate = i > 0 ? sidebarGroups[i - 1]!.date : null;
            const showYear = !prevDate || date.getFullYear() !== prevDate.getFullYear();

            return (
              <React.Fragment key={date.toISOString()}>
                {showYear && (
                  <span className={styles.sidebarYear}>{date.getFullYear()}</span>
                )}
                <button
                  ref={isActive ? activeBtnRef : undefined}
                  className={`${styles.sidebarBtn} ${isActive ? styles.sidebarBtnActive : ''}`}
                  onClick={() => virtualizer.scrollToIndex(rowIndex, { align: 'start' })}
                  title={date.toLocaleDateString(undefined, {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                >
                  <span className={styles.sidebarMonth}>
                    {date.toLocaleDateString(undefined, { month: 'short' })}
                  </span>
                  {!useMonths && (
                    <span className={styles.sidebarDay}>
                      {date.toLocaleDateString(undefined, { day: 'numeric' })}
                    </span>
                  )}
                </button>
              </React.Fragment>
            );
          })}
        </nav>
      ) : null}
    </div>
  );
}
