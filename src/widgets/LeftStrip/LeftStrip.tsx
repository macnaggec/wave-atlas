import React from 'react';
import styles from './LeftStrip.module.css';
import { ActionIcon, Divider, Tooltip } from '@mantine/core';
import { IconCompass, IconCloudUpload } from '@tabler/icons-react';
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

        <Divider className={styles.divider} />

        <div className={styles.modeGroup}>
          <Tooltip label="Explore" position="right" withArrow>
            <ActionIcon
              className={`${styles.modeBtn} ${!isUploadMode ? styles.active : ''}`}
              size="lg"
              variant="transparent"
              onClick={() => onToggleUpload(false)}
              aria-label="Explore"
            >
              <IconCompass size={20} />
            </ActionIcon>
          </Tooltip>

          <Tooltip label="Upload" position="right" withArrow>
            <ActionIcon
              className={`${styles.modeBtn} ${isUploadMode ? styles.active : ''}`}
              size="lg"
              variant="transparent"
              onClick={() => onToggleUpload(true)}
              aria-label="Upload"
            >
              <IconCloudUpload size={20} />
            </ActionIcon>
          </Tooltip>
        </div>

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
