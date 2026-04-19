import { useCallback } from 'react';
import { MediaItem } from 'entities/Media/types';
import { useCartStore } from 'features/Cart/model/cartStore';
import { toCartItem } from 'features/Cart/model/toCartItem';

/**
 * Maps a MediaItem to a domain-agnostic CartItem and binds cart actions.
 * This is the only place that knows both MediaItem shape and CartItem shape.
 */
export function useCartItem(item: MediaItem, spotName: string) {
  const add = useCartStore((s) => s.add);
  const remove = useCartStore((s) => s.remove);
  const isInCart = useCartStore((s) => s.items.some((i) => i.id === item.id));

  const addToCart = useCallback(() => {
    add(toCartItem(item, spotName));
  }, [add, item, spotName]);

  const removeFromCart = useCallback(() => {
    remove(item.id);
  }, [remove, item.id]);

  return { isInCart, addToCart, removeFromCart };
}
