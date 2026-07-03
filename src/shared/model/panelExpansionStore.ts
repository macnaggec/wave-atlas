import { useSyncExternalStore } from 'react';

let renderedPanelExpanded = false;
const listeners = new Set<() => void>();

export function getRenderedPanelExpandedSnapshot() {
  return renderedPanelExpanded;
}

export function setRenderedPanelExpandedSnapshot(expanded: boolean) {
  if (renderedPanelExpanded === expanded) return;

  renderedPanelExpanded = expanded;
  listeners.forEach((listener) => listener());
}

export function subscribeRenderedPanelExpandedSnapshot(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useRenderedPanelExpandedSnapshot() {
  return useSyncExternalStore(
    subscribeRenderedPanelExpandedSnapshot,
    getRenderedPanelExpandedSnapshot,
    () => false,
  );
}
