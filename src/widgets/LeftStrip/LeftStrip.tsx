import styles from './LeftStrip.module.css';
import { useUser } from 'shared/hooks/useUser';
import { useCartStore } from 'features/Cart/model/cartStore';
import { CartControl } from './CartControl';
import { UserControl } from './UserControl';

export function LeftStrip() {
  const { isAuthenticated } = useUser();
  const cartCount = useCartStore((s) => s.items.length);
  return (
    <div className={styles.root}>
      <div className={styles.stack}>
        <div className={styles.button}>
          <UserControl />
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
