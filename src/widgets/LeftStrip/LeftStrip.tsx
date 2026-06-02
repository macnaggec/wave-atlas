import styles from './LeftStrip.module.css';
import { useUser } from 'shared/hooks/useUser';
import { useCartStore } from 'features/Cart/model/cartStore';
import { CartControl } from './CartControl';
import { UserControl } from './UserControl';

interface LeftStripProps {
  onOpenCollection?: () => void;
}

export function LeftStrip({ onOpenCollection }: LeftStripProps) {
  const { isAuthenticated } = useUser();
  const cartCount = useCartStore((s) => s.items.length);
  return (
    <div className={styles.root}>
      <div className={styles.stack}>
        <div className={styles.button}>
          <UserControl onOpenCollection={onOpenCollection} />
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
