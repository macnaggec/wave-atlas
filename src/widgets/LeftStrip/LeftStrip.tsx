import React from 'react';
import styles from './LeftStrip.module.css';
import { ActionIcon } from '@mantine/core';
import { CartControl } from '../Header/CartControl';
import { UserControl } from '../Header/UserControl';
import { useUser } from 'shared/hooks/useUser';
import { useCartStore } from 'features/Cart/model/cartStore';

interface LeftStripProps {
  isUploadMode: boolean;
  onToggleUpload: (value?: boolean) => void;
}

export function LeftStrip({ isUploadMode, onToggleUpload }: LeftStripProps) {
  const { isAuthenticated } = useUser();
  const cartCount = useCartStore((s) => s.items.length);
  return (
    <div className={styles.root} aria-hidden={false}>
      <div className={styles.stack}>
        <div className={styles.button}>
          <UserControl />
        </div>

        <ActionIcon
          className={`${styles.button} ${!isUploadMode ? styles.active : ''}`}
          size="lg"
          onClick={() => onToggleUpload(false)}
          aria-label="Explore"
        >
          🗺
        </ActionIcon>

        <ActionIcon
          className={`${styles.button} ${isUploadMode ? styles.active : ''}`}
          size="lg"
          onClick={() => onToggleUpload(true)}
          aria-label="Upload"
        >
          ⬆
        </ActionIcon>

        {isAuthenticated && cartCount > 0 && (
          <div className={styles.button}>
            <CartControl />
          </div>
        )}
      </div>
    </div>
  );
}

export default LeftStrip;
