import { memo } from 'react';
import { Anchor, Drawer, Group, Text } from '@mantine/core';
import { IconChevronLeft } from '@tabler/icons-react';
import styles from './CartDrawerHeader.module.css';

interface CartDrawerHeaderProps {
  itemCount: number;
  spotName?: string;
  onBack?: () => void;
}

/**
 * CartDrawerHeader — 3-column header for the cart drawer.
 *
 * Left: optional back link to the originating spot.
 * Center: "Cart (n)" title.
 * Right: close button.
 */
export const CartDrawerHeader = memo(function CartDrawerHeader({
  itemCount,
  spotName,
  onBack,
}: CartDrawerHeaderProps) {
  return (
    <Drawer.Header>
      <div className={styles.header}>
        <div>
          {spotName && onBack && (
            <Anchor
              component="button"
              size="xs"
              c="dimmed"
              onClick={onBack}
            >
              <Group gap={2} align="center">
                <IconChevronLeft size={12} />
                {spotName}
              </Group>
            </Anchor>
          )}
        </div>
        <Text fw={600} size="lg" ta="center">
          Cart{itemCount > 0 ? ` (${itemCount})` : ''}
        </Text>
        <div className={styles.headerEnd}>
          <Drawer.CloseButton />
        </div>
      </div>
    </Drawer.Header>
  );
});
