import type { ReactNode } from 'react';
import styles from './PanelGalleryLayout.module.css';

interface PanelGalleryLayoutProps {
  meta?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}

export function PanelGalleryLayout({ meta, footer, children }: PanelGalleryLayoutProps) {
  return (
    <div className={styles.root}>
      {meta && (
        <div className={styles.meta} data-panel-gallery-meta>
          {meta}
        </div>
      )}

      <div className={styles.scroller} data-panel-gallery-scroller>
        <div
          className={`${styles.galleryInset} ${footer ? styles.galleryInsetWithFooter : ''}`}
          data-panel-gallery-inset
        >
          {children}
        </div>
      </div>

      {footer && (
        <div className={styles.footer} data-panel-gallery-footer="fixed">
          {footer}
        </div>
      )}
    </div>
  );
}
