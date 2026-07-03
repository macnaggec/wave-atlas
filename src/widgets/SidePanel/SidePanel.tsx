import type { ReactNode } from 'react';
import { IconChevronLeft, IconMaximize, IconMinimize } from '@tabler/icons-react';
import { motion } from 'framer-motion';
import { materialClasses } from 'shared/ui/design-system';
import { SIDE_PANEL_TRANSITION } from './panelMotion';
import styles from './SidePanel.module.css';

interface SidePanelProps {
  /** Expands the panel to cover most of the viewport width. */
  expanded?: boolean;
  /** Called when the expand/collapse toggle is clicked. */
  onExpandToggle?: () => void;
  /** When provided, replaces the expand toggle with a ‹ back button. */
  onBack?: () => void;
  /** Visible label for the back button when the context needs more clarity. */
  backLabel?: string;
  /** Center slot in the top bar (e.g. ModeSwitcher or search bar). */
  header?: ReactNode;
  /** Allows rich headers, such as cart controls, to span the full top row. */
  headerFullWidth?: boolean;
  /** Full-width row below the top bar, above the scrollable body (e.g. search in State A). */
  subheader?: ReactNode;
  children?: ReactNode;
}

export function SidePanel({
  expanded,
  onExpandToggle,
  onBack,
  backLabel,
  header,
  headerFullWidth,
  subheader,
  children,
}: SidePanelProps) {
  return (
    <motion.div
      className={`${styles.panel} ${materialClasses.panel} ${materialClasses.context}`}
      initial={false}
      animate={{ width: expanded ? '75vw' : '25vw' }}
      transition={{ width: SIDE_PANEL_TRANSITION }}
    >
      {/* Top bar: [expand/back] [center: header] */}
      <div className={styles.panelTop}>
        {onBack || onExpandToggle ? (
          <button
            className={`${styles.topBtn} ${backLabel ? styles.topBtnLabeled : ''}`}
            onClick={onBack ?? onExpandToggle}
            aria-label={onBack ? backLabel ?? 'Back' : expanded ? 'Collapse panel' : 'Expand panel'}
          >
            {onBack ? (
              <>
                <IconChevronLeft size={16} />
                {backLabel && <span>{backLabel}</span>}
              </>
            ) : expanded ? (
              <IconMinimize size={16} />
            ) : (
              <IconMaximize size={16} />
            )}
          </button>
        ) : (
          <div aria-hidden="true" />
        )}

        {header && (
          <div className={headerFullWidth ? styles.headerSlotFull : styles.headerSlot}>
            {header}
          </div>
        )}
        {!headerFullWidth && <div aria-hidden="true" />}
      </div>

      {/* Subheader: full-width row below top bar (e.g. search in State A) */}
      {subheader && <div className={styles.subheader}>{subheader}</div>}

      {/* Body */}
      <div className={`${styles.body} ${materialClasses.context}`}>{children}</div>
    </motion.div>
  );
}
