import { RefObject, useEffect } from 'react';

/**
 * Walk up the DOM tree to find the nearest scrollable ancestor.
 * Checks overflow-y for 'auto' or 'scroll'.
 */
function findScrollParent(el: HTMLElement): HTMLElement | null {
  let node: HTMLElement | null = el.parentElement;
  while (node) {
    const { overflowY } = getComputedStyle(node);
    if (overflowY === 'auto' || overflowY === 'scroll') return node;
    node = node.parentElement;
  }
  return null;
}

/**
 * useScrollHidden — hides an element when scrolling down, reveals on scroll up.
 *
 * Sets `data-hidden` attribute on the element, driven by the nearest
 * scrollable ancestor's scroll events.
 *
 * @param ref   - ref to the element to show/hide
 * @param locked - when true, keeps element always visible (e.g. selection mode)
 */
export function useScrollHidden(
  ref: RefObject<HTMLElement | null>,
  locked = false,
) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (locked) {
      el.removeAttribute('data-hidden');
      return;
    }

    const container = findScrollParent(el);
    if (!container) return;

    let lastY = container.scrollTop;

    function onScroll() {
      const y = container!.scrollTop;
      if (y > lastY && y > 0) {
        el!.setAttribute('data-hidden', '');
      } else {
        el!.removeAttribute('data-hidden');
      }
      lastY = y;
    }

    container.addEventListener('scroll', onScroll, { passive: true });

    return () => container.removeEventListener('scroll', onScroll);
  }, [locked]);
}
