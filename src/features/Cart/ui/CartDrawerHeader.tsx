import { memo } from 'react';
import { Anchor, Group, Text, ActionIcon } from '@mantine/core';
import { IconChevronLeft, IconX } from '@tabler/icons-react';
import { useNavigate } from '@tanstack/react-router';
import styles from './CartDrawerHeader.module.css';

interface CartDrawerHeaderProps {
  itemCount: number;
  spotName?: string;
  onBack?: () => void;
}

/**
 * CartDrawerHeader — 3-column header for the cart panel.
 *
 * Left: optional back link to the originating spot.
 * Center: "Cart (n)" title.
 * Right: close button (navigates to /).
 */
export const CartDrawerHeader = memo(function CartDrawerHeader({
  itemCount,
  spotName,
  onBack,
}: CartDrawerHeaderProps) {
  const navigate = useNavigate();

  return (
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
        <ActionIcon
          variant="subtle"
          size="sm"
          aria-label="Close cart"
          onClick={() => void navigate({ to: '/' })}
        >
          <IconX size={16} />
        </ActionIcon>
      </div>
    </div>
  );
});
