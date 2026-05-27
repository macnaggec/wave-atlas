import type { ReactNode } from 'react';
import { IconChevronRight, IconChevronLeft, IconX } from '@tabler/icons-react';
import styles from './SidePanel.module.css';

interface SidePanelProps {
  isOpen: boolean;
  /** Called when the tongue tab is clicked to reopen the panel. */
  onOpen: () => void;
  /** Called when the X button is clicked to close and reveal the map. Only active in one-column state. */
  onClose: () => void;
  /** Expands the panel to cover most of the viewport width. */
  expanded?: boolean;
  /** Called when the left chevron is clicked to toggle expand/collapse. */
  onExpandToggle?: () => void;
  /** Center slot in the top bar (e.g. Browse/Upload SegmentedControl). */
  header?: ReactNode;
  /** Full-width row below the top bar, above the scrollable body (e.g. search). */
  subheader?: ReactNode;
  /** Optional label on the tongue tab (shown when panel is closed). */
  tongueLabel?: string;
  children?: ReactNode;
}

export function SidePanel({
  isOpen,
  onOpen,
  onClose,
  expanded,
  onExpandToggle,
  header,
  subheader,
  tongueLabel,
  children,
}: SidePanelProps) {
  const panelClass = [
    styles.panel,
    !isOpen ? styles.panelClosed : '',
    expanded ? styles.panelExpanded : '',
  ]
    .filter(Boolean)
    .join(' ');

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

      {/* Sliding panel */}
      <div className={panelClass} aria-hidden={!isOpen}>
        {/* Top bar: [← expand] [center: header] */}
        <div className={styles.panelTop}>
          <button
            className={styles.chevronBtn}
            onClick={onExpandToggle}
            aria-label={expanded ? 'Collapse panel' : 'Expand panel'}
          >
            {expanded ? <IconChevronRight size={16} /> : <IconChevronLeft size={16} />}
          </button>

          {header && <div className={styles.headerSlot}>{header}</div>}

          {/* Phantom spacer — balances the left chevron so header stays truly centered */}
          <div className={styles.chevronBtn} aria-hidden="true" />
        </div>

        {/* X button — top-right corner, one-column state only */}
        <button
          className={`${styles.closeBtn} ${expanded ? styles.closeBtnHidden : ''}`}
          onClick={onClose}
          aria-label="Close panel"
          tabIndex={expanded ? -1 : undefined}
        >
          <IconX size={16} />
        </button>

        {/* Subheader: search bar, shown below top bar, above scrollable body */}
        {subheader && <div className={styles.subheader}>{subheader}</div>}

        {/* Body */}
        <div className={styles.body}>{children}</div>
      </div>
    </>
  );
}
