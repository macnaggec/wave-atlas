import type { ReactNode } from 'react';
import { IconChevronRight, IconChevronLeft, IconArrowLeft } from '@tabler/icons-react';
import styles from './SidePanel.module.css';

interface SidePanelProps {
  isOpen: boolean;
  onToggle: () => void;
  /** Expands the panel to cover most of the viewport width. */
  expanded?: boolean;
  /** Optional content rendered in the top bar alongside the close chevron. */
  header?: ReactNode;
  /** Optional label on the tongue tab (shown when panel is closed). */
  tongueLabel?: string;
  /**
   * When set, replaces the close chevron with a back-arrow + label.
   * Use in upload mode so the button communicates "return to feed" intent.
   */
  backLabel?: string;
  children?: ReactNode;
}

export function SidePanel({
  isOpen,
  onToggle,
  expanded,
  header,
  tongueLabel,
  backLabel,
  children,
}: SidePanelProps) {
  const panelClass = [
    styles.panel,
    !isOpen ? styles.panelClosed : '',
    expanded ? styles.panelExpanded : '',
  ]
    .filter(Boolean)
    .join(' ');

  const tongueHidden = isOpen || expanded;

  return (
    <>
      {/* Tongue tab — visible only when panel is closed and not expanded */}
      <button
        className={`${styles.tongue} ${tongueHidden ? styles.tongueHidden : ''}`}
        onClick={onToggle}
        aria-label="Open panel"
      >
        <IconChevronLeft size={14} className={styles.tongueIcon} />
        {tongueLabel && <span className={styles.tongueLabel}>{tongueLabel}</span>}
      </button>

      {/* Sliding panel */}
      <div className={panelClass} aria-hidden={!isOpen && !expanded}>
        {/* Top bar: close/back button + optional header slot */}
        <div className={styles.panelTop}>
          {backLabel ? (
            <button
              className={styles.chevronBtn}
              onClick={onToggle}
              aria-label={`Back to ${backLabel}`}
            >
              <IconArrowLeft size={16} />
              <span className={styles.backLabel}>{backLabel}</span>
            </button>
          ) : (
            <button className={styles.chevronBtn} onClick={onToggle} aria-label="Close panel">
              <IconChevronRight size={16} />
            </button>
          )}
          {header && <div className={styles.headerSlot}>{header}</div>}
        </div>

        {/* Body */}
        <div className={styles.body}>{children}</div>
      </div>
    </>
  );
}
