import { memo, useCallback } from 'react';
import { ActionIcon, Indicator } from '@mantine/core';
import { IconShoppingCart } from '@tabler/icons-react';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { useCartStore } from 'features/Cart/model/cartStore';
import { useUser } from 'shared/hooks/useUser';
import classes from './Header.module.css';

/**
 * CartControl — cart icon button in the header.
 *
 * Navigates to /cart to open the route-driven cart drawer.
 * Navigates to / to close it if already on /cart.
 */
export const CartControl = memo(function CartControl() {
  const navigate = useNavigate();
  const { isCartRoute, currentSpotId } = useRouterState({
    select: (s) => ({
      isCartRoute: s.location.pathname === '/cart',
      currentSpotId: s.matches
        .flatMap((m) => {
          const id = (m.params as { spotId?: string }).spotId;
          return id ? [id] : [];
        })
        .at(0),
    }),
  });
  const count = useCartStore((s) => s.items.length);
  const { isAuthenticated } = useUser();

  const handleClick = useCallback(() => {
    void navigate({
      to: isCartRoute ? '/' : '/cart',
      search: !isCartRoute && currentSpotId ? { from: currentSpotId } : undefined,
    });
  }, [navigate, isCartRoute, currentSpotId]);

  if (!isAuthenticated || count === 0) return null;

  return (
    <Indicator
      label={count}
      size={16}
      color='pink'
      classNames={{ indicator: classes.cartIndicator }}
    >
      <ActionIcon
        variant={'outline'}
        size="lg"
        radius="xl"
        color='green'
        className={classes.cartButton}
        aria-label={`Cart, ${count} item${count !== 1 ? 's' : ''}`}
        onClick={handleClick}
      >
        <IconShoppingCart size={18} />
      </ActionIcon>
    </Indicator>
  );
});
