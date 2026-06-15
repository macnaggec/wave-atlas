import type { ReactNode } from 'react';
import { IconChevronLeft, IconChevronRight, IconMaximize, IconMinimize } from '@tabler/icons-react';
import styles from './SidePanel.module.css';

interface SidePanelProps {
  isOpen: boolean;
  /** Called when the tongue tab is clicked to reopen the panel. */
  onOpen: () => void;
  /** Called when the hide button (›) is clicked to collapse to tongue. */
  onClose: () => void;
  /** Expands the panel to cover most of the viewport width. */
  expanded?: boolean;
  /** Called when the expand/collapse toggle is clicked. */
  onExpandToggle?: () => void;
  /** When provided, replaces the expand toggle with a ‹ back button. */
  onBack?: () => void;
  /** Hides the › collapse button on the right of the top bar. */
  hideClose?: boolean;
  /** Center slot in the top bar (e.g. ModeSwitcher or search bar). */
  header?: ReactNode;
  /** Right-of-header slot in the top bar (e.g. an Upload button). */
  topAction?: ReactNode;
  /** Full-width row below the top bar, above the scrollable body (e.g. search in State A). */
  subheader?: ReactNode;
  /** Label on the tongue tab (shown when panel is closed). */
  tongueLabel?: string;
  children?: ReactNode;
}

export function SidePanel({
  isOpen,
  onOpen,
  onClose,
  expanded,
  onExpandToggle,
  onBack,
  hideClose,
  header,
  topAction,
  subheader,
  tongueLabel,
  children,
}: SidePanelProps) {
  const panelClass = [
    styles.panel,
    !isOpen ? styles.panelClosed : '',
    expanded ? styles.panelExpanded : '',
  ].filter(Boolean).join(' ');

  return (
    <>
      {/* Tongue tab — visible only when panel is closed */}
      <button
        className={`${styles.tongue} ${isOpen ? styles.tongueHidden : ''}`}
        onClick={onOpen}
        aria-label="Open panel"
      >
        <IconChevronLeft size={14} className={styles.tongueIcon} />
        {tongueLabel && <span className={styles.tongueLabel}>{tongueLabel}</span>}
      </button>

      <div className={panelClass} aria-hidden={!isOpen}>
        {/* Top bar: [expand/back] [center: header] [hide ›] */}
        <div className={styles.panelTop}>
          <button
            className={`${styles.topBtn} ${!onBack && !onExpandToggle ? styles.topBtnHidden : ''}`}
            onClick={onBack ?? onExpandToggle}
            aria-label={onBack ? 'Back' : expanded ? 'Collapse panel' : 'Expand panel'}
            tabIndex={!onBack && !onExpandToggle ? -1 : undefined}
          >
            {onBack
              ? <IconChevronLeft size={16} />
              : expanded
              ? <IconMinimize size={16} />
              : <IconMaximize size={16} />}
          </button>

          {header && <div className={styles.headerSlot}>{header}</div>}

          {topAction && <div className={styles.topActionSlot}>{topAction}</div>}

          {!hideClose && (
            <button
              className={styles.topBtn}
              onClick={onClose}
              aria-label="Hide panel"
            >
              <IconChevronRight size={16} />
            </button>
          )}
        </div>

        {/* Subheader: full-width row below top bar (e.g. search in State A) */}
        {subheader && <div className={styles.subheader}>{subheader}</div>}

        {/* Body */}
        <div className={`${styles.body} dark-surface`}>{children}</div>
      </div>
    </>
  );
}
