import { type ReactNode } from 'react';
import { Drawer } from '@mantine/core';
import styles from './DrawerLayout.module.css';

/**
 * Layout primitives for Mantine drawer routes.
 *
 * Mantine's Drawer.Content applies `transform` for slide animation, making it
 * a CSS containing block. It also sets overflow-y: auto on the whole panel.
 * These components fix both: DrawerLayout isolates scroll to DrawerBody only
 * and provides the containing block for FloatingAction buttons.
 */

/** Flex-column wrapper — overflow: hidden, position: relative containing block. */
export function DrawerLayout({ children }: { children: ReactNode }) {
  return <div className={styles.layout}>{children}</div>;
}

/** Drawer.Body with flex: 1 / overflow-y: auto — the sole scroll container. */
export function DrawerBody({ children }: { children: ReactNode }) {
  return <Drawer.Body className={styles.body}>{children}</Drawer.Body>;
}

/** Drawer.Header with CloseButton included — accepts title as children. */
export function DrawerHeader({ children }: { children: ReactNode }) {
  return (
    <Drawer.Header>
      {children}
      <Drawer.CloseButton />
    </Drawer.Header>
  );
}

/** Absolute bottom-center anchor for floating action buttons (Publish, Cart, Checkout). */
export function FloatingAction({ children }: { children: ReactNode }) {
  return <div className={styles.floatingAction}>{children}</div>;
}
