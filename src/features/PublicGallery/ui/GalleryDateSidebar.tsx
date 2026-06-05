import React, { useEffect, useMemo, useRef } from 'react';
import type { VirtualGalleryHandle } from 'shared/ui/VirtualGallery/VirtualGallery';
import styles from './GalleryDateSidebar.module.css';

interface GalleryDateSidebarProps {
  highlights: { date: Date; rowIndex: number }[];
  firstVisibleIndex: number;
  galleryRef: React.RefObject<VirtualGalleryHandle | null>;
}

const SIDEBAR_MAX = 12;

export function GalleryDateSidebar({ highlights, firstVisibleIndex, galleryRef }: GalleryDateSidebarProps) {
  const useMonths = highlights.length > SIDEBAR_MAX;

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

  const activeHighlightIndex = useMemo(() => {
    let active = 0;
    for (let i = 0; i < highlights.length; i++) {
      if (highlights[i]!.rowIndex <= firstVisibleIndex) active = i;
      else break;
    }
    return active;
  }, [firstVisibleIndex, highlights]);

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

  const activeBtnRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    activeBtnRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeSidebarIndex]);

  if (highlights.length === 0) return null;

  return (
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
              onClick={() => galleryRef.current?.scrollToIndex(rowIndex, { align: 'start' })}
              title={date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
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
  );
}
