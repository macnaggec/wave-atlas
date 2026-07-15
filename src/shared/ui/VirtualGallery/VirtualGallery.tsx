import React, { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Loader } from '@mantine/core';
import type { GalleryRow } from 'shared/lib/buildGalleryRows';
import type { CardContext } from 'shared/ui/BaseGallery/BaseGallery';
import SelectionCheckbox from 'shared/ui/BaseGallery/SelectionCheckbox';
import { PanelScrollChrome, usePanelScrollChromeState } from 'shared/ui/PanelScrollChrome';
import styles from './VirtualGallery.module.css';

const DIVIDER_HEIGHT = 32;
const CARD_ROW_ESTIMATE = 220;
const ACTIVE_ROW_ANCHOR_RATIO = 0.2;

interface MeasuredVirtualRow {
  index: number;
  start: number;
  size: number;
}

export function getAnchoredVisibleRowIndex(
  virtualItems: MeasuredVirtualRow[],
  scrollTop: number,
  viewportHeight: number,
) {
  const anchorOffset = scrollTop + (viewportHeight * ACTIVE_ROW_ANCHOR_RATIO);
  return virtualItems.find((vi) => vi.start + vi.size > anchorOffset)?.index ?? 0;
}

interface SelectionState {
  isSelectionMode: boolean;
  isSelected: (id: string) => boolean;
  toggle: (id: string) => void;
}

export interface VirtualGalleryHandle {
  scrollToIndex: (index: number, options?: { align: 'start' | 'center' | 'end' | 'auto' }) => void;
}

export interface VirtualGalleryProps<T extends { id: string }> {
  rows: GalleryRow<T>[];
  /** Cards per media row — must match the column count used to build `rows`. */
  columns?: number;
  /** Dense mode: gapless, edge-to-edge tiles. */
  dense?: boolean;
  renderCard: (item: T, context: CardContext) => ReactNode;
  selection?: SelectionState;
  toolbar?: ReactNode;
  onEndReached?: () => void;
  isFetchingMore?: boolean;
  /** Called when the anchored visible row index changes — use to drive an external sidebar. */
  onFirstVisibleIndexChange?: (index: number) => void;
}

function VirtualGalleryInner<T extends { id: string }>(
  {
    rows,
    columns = 3,
    dense = false,
    renderCard,
    selection,
    toolbar,
    onEndReached,
    isFetchingMore,
    onFirstVisibleIndexChange,
  }: VirtualGalleryProps<T>,
  ref: React.ForwardedRef<VirtualGalleryHandle>,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { hidden: panelChromeHidden } = usePanelScrollChromeState();

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Virtual exposes imperative functions that React Compiler intentionally leaves un-memoized.
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => containerRef.current,
    estimateSize: (i) => {
      const row = rows[i];
      if (row?.type === 'divider') return DIVIDER_HEIGHT;
      return CARD_ROW_ESTIMATE;
    },
    measureElement: (el) => el.getBoundingClientRect().height,
    overscan: 3,
  });

  React.useImperativeHandle(ref, () => ({
    scrollToIndex: (index, options) => virtualizer.scrollToIndex(index, options),
  }), [virtualizer]);

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

  useEffect(() => {
    if (lastIndex >= rows.length - 3) onEndReached?.();
  }, [lastIndex, rows.length, onEndReached]);

  // Scroll tracking — feeds onFirstVisibleIndexChange for external sidebars
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  useEffect(() => {
    if (!onFirstVisibleIndexChange) return;
    const container = containerRef.current;
    if (!container) return;
    setViewportHeight(container.clientHeight);
    const onScroll = () => {
      setScrollTop(container.scrollTop);
      setViewportHeight(container.clientHeight);
    };
    container.addEventListener('scroll', onScroll, { passive: true });
    return () => container.removeEventListener('scroll', onScroll);
  }, [onFirstVisibleIndexChange]);

  const firstVisibleIndex = useMemo(
    () => getAnchoredVisibleRowIndex(virtualItems, scrollTop, viewportHeight),
    [virtualItems, scrollTop, viewportHeight],
  );

  useEffect(() => {
    onFirstVisibleIndexChange?.(firstVisibleIndex);
  }, [firstVisibleIndex, onFirstVisibleIndexChange]);

  const handleItemClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const itemId = e.currentTarget.getAttribute('data-item-id');
      if (itemId && selection?.isSelectionMode) selection.toggle(itemId);
    },
    [selection],
  );

  return (
    <div
      ref={containerRef}
      className={styles.container}
      data-dense={dense || undefined}
      style={{ '--gallery-cols': columns } as React.CSSProperties}
    >
      <PanelScrollChrome />
      {toolbar && (
        <div
          className={styles.toolbar}
          data-hidden={(panelChromeHidden && !selection?.isSelectionMode) || undefined}
        >
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
                <div className={styles.divider}>
                  <span className={styles.dividerText}>
                    {row.date.toLocaleDateString(undefined, {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </span>
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
  );
}

export const VirtualGallery = React.forwardRef(VirtualGalleryInner) as <T extends { id: string }>(
  props: VirtualGalleryProps<T> & React.RefAttributes<VirtualGalleryHandle>
) => React.ReactElement | null;
