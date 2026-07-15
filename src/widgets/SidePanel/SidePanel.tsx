import { useCallback, useRef, useState, type ReactNode, type UIEvent } from 'react';
import { IconChevronLeft, IconMaximize, IconMinimize } from '@tabler/icons-react';
import { motion } from 'framer-motion';
import { materialClasses } from 'shared/ui/design-system';
import {
  PanelScrollChrome,
  PanelScrollChromeProvider,
  PanelScrollChromeStateProvider,
} from 'shared/ui/PanelScrollChrome';
import { PANEL_WIDTH_VW } from 'shared/model/panelExpansionStore';
import { SIDE_PANEL_TRANSITION } from './panelMotion';
import styles from './SidePanel.module.css';

const SCROLL_DIRECTION_THRESHOLD_PX = 8;

interface ScrollPosition {
  anchor: number;
  hidden: boolean;
}

interface SidePanelProps {
  /** Expands the panel to cover most of the viewport width. */
  expanded?: boolean;
  /** Called when the expand/collapse toggle is clicked. */
  onExpandToggle?: () => void;
  /** When provided, replaces the expand toggle with a ‹ back button. */
  onBack?: () => void;
  /** Visible label for the back button when the context needs more clarity. */
  backLabel?: string;
  /** Disables the visible back control without removing it from the title row. */
  backDisabled?: boolean;
  /** Center slot in the top bar (e.g. ModeSwitcher or search bar). */
  header?: ReactNode;
  /** Allows rich headers, such as cart controls, to span the full top row. */
  headerFullWidth?: boolean;
  /** Full-width row below the top bar, above the scrollable body (e.g. search in State A). */
  subheader?: ReactNode;
  /** Hides panel chrome when gallery-like panel content scrolls down, reveals it on scroll up. */
  hideSubheaderOnScroll?: boolean;
  children?: ReactNode;
}

export function SidePanel({
  expanded,
  onExpandToggle,
  onBack,
  backLabel,
  backDisabled,
  header,
  headerFullWidth,
  subheader,
  hideSubheaderOnScroll,
  children,
}: SidePanelProps) {
  const scrollPositionByTargetRef = useRef<WeakMap<HTMLElement, ScrollPosition>>(new WeakMap());
  const [scrollChromeState, setScrollChromeState] = useState({ hidden: false });

  const handleBodyScrollCapture = useCallback((event: UIEvent<HTMLDivElement>) => {
    const scrollTarget = event.target;
    if (!(scrollTarget instanceof HTMLElement)) return;

    const currentScrollTop = scrollTarget.scrollTop;
    const position = scrollPositionByTargetRef.current.get(scrollTarget) ?? {
      anchor: 0,
      hidden: false,
    };

    if (currentScrollTop <= 0) {
      position.anchor = 0;
      position.hidden = false;
    } else if (position.hidden) {
      if (currentScrollTop > position.anchor) position.anchor = currentScrollTop;
      else if (position.anchor - currentScrollTop >= SCROLL_DIRECTION_THRESHOLD_PX) {
        position.anchor = currentScrollTop;
        position.hidden = false;
      }
    } else {
      if (currentScrollTop < position.anchor) position.anchor = currentScrollTop;
      else if (currentScrollTop - position.anchor >= SCROLL_DIRECTION_THRESHOLD_PX) {
        position.anchor = currentScrollTop;
        position.hidden = true;
      }
    }

    setScrollChromeState((current) => {
      return current.hidden === position.hidden ? current : { hidden: position.hidden };
    });
    scrollPositionByTargetRef.current.set(scrollTarget, position);
  }, []);

  return (
    <motion.div
      className={`${styles.panel} ${materialClasses.panel}`}
      initial={false}
      animate={{ width: expanded ? `${PANEL_WIDTH_VW.expanded}vw` : `${PANEL_WIDTH_VW.compact}vw` }}
      transition={{ width: SIDE_PANEL_TRANSITION }}
    >
      {/* Top bar: [expand/back] [center: header] */}
      <div className={styles.panelTop}>
        {!headerFullWidth && (
          onBack || onExpandToggle ? (
            <button
              className={`${styles.topBtn} ${backLabel ? styles.topBtnLabeled : ''}`}
              onClick={onBack ?? onExpandToggle}
              disabled={backDisabled}
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
          )
        )}

        {header && (
          <div className={headerFullWidth ? styles.headerSlotFull : styles.headerSlot}>
            {header}
          </div>
        )}
        {!headerFullWidth && <div aria-hidden="true" />}
      </div>

      {/* Stable chrome is projected into the element that owns scrollTop. */}
      <PanelScrollChromeProvider value={subheader}>
        {!hideSubheaderOnScroll && subheader && (
          <PanelScrollChrome />
        )}

        {/* Body */}
        <PanelScrollChromeStateProvider value={scrollChromeState}>
          <div
            className={styles.body}
            onScrollCapture={handleBodyScrollCapture}
          >
            {children}
          </div>
        </PanelScrollChromeStateProvider>
      </PanelScrollChromeProvider>
    </motion.div>
  );
}
