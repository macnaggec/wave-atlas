import { useSyncExternalStore } from 'react';
import { create } from 'zustand';

/** Single source of truth for the panel's two fixed widths, shared with the globe's camera occlusion math. */
export const PANEL_WIDTH_VW = { compact: 25, expanded: 75 } as const;

interface PanelExpansionPreferences {
  browsingExpanded: boolean;
  galleryExpanded: boolean;
  setBrowsingPanelExpanded: (expanded: boolean) => void;
  setGalleryPanelExpanded: (expanded: boolean) => void;
}

/** Authoritative user preferences for the two panel modes that support manual expansion. */
export const usePanelExpansionStore = create<PanelExpansionPreferences>((set) => ({
  browsingExpanded: false,
  galleryExpanded: true,
  setBrowsingPanelExpanded: (expanded) => set({ browsingExpanded: expanded }),
  setGalleryPanelExpanded: (expanded) => set({ galleryExpanded: expanded }),
}));

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
