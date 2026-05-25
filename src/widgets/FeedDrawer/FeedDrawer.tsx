import type { ReactNode } from 'react';
import { IconChevronRight, IconChevronLeft } from '@tabler/icons-react';
import styles from './FeedDrawer.module.css';

interface FeedDrawerProps {
  isOpen: boolean;
  onToggle: () => void;
  search?: ReactNode;
  children?: ReactNode;
}

export function FeedDrawer({ isOpen, onToggle, search, children }: FeedDrawerProps) {
  return (
    <>
      {/* Tongue tab — visible when panel is closed */}
      <button
        className={`${styles.tongue} ${isOpen ? styles.tongueHidden : ''}`}
        onClick={onToggle}
        aria-label="Open feed"
      >
        <IconChevronLeft size={14} className={styles.tongueIcon} />
        <span className={styles.tongueLabel}>Feed</span>
      </button>

      {/* Sliding panel */}
      <div
        className={`${styles.panel} ${!isOpen ? styles.panelClosed : ''}`}
        aria-hidden={!isOpen}
      >
        {/* Top row: collapse chevron + search bar */}
        <div className={styles.panelTop}>
          <button className={styles.chevronBtn} onClick={onToggle} aria-label="Close feed">
            <IconChevronRight size={16} />
          </button>
          {search && <div className={styles.searchWrapper}>{search}</div>}
        </div>

        {/* Feed body */}
        <div className={styles.body}>{children}</div>
      </div>
    </>
  );
}
