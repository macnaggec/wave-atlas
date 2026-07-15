import styles from './LeftStrip.module.css';
import { materialClasses } from 'shared/ui/design-system';
import { useCartStore } from 'entities/Commerce';
import { CartControl } from './CartControl';
import { UserControl } from './UserControl';

export function LeftStrip() {
  const cartCount = useCartStore((s) => s.items.length);
  return (
    <div className={styles.root}>
      <div className={`${styles.stack} ${materialClasses.chrome}`}>
        <div className={styles.button}>
          <UserControl />
        </div>
        {cartCount > 0 && (
          <div className={styles.button}>
            <CartControl />
          </div>
        )}
      </div>
    </div>
  );
}

export default LeftStrip;
