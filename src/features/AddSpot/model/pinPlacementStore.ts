import { create } from 'zustand';
import type { LngLat } from 'shared/types/coordinates';

interface PinPlacementState {
  isActive: boolean;
  /** Temporary pin position while in pin-placement mode. */
  tempPin: LngLat | null;
  /** Name pre-filled from the search query that triggered pin-placement. */
  pendingSpotName: string;
}

interface PinPlacementActions {
  enter: (initialName?: string) => void;
  exit: () => void;
  setTempPin: (pos: LngLat) => void;
  clearTempPin: () => void;
}

export const usePinPlacementStore = create<PinPlacementState & PinPlacementActions>((set) => ({
  isActive: false,
  tempPin: null,
  pendingSpotName: '',

  enter: (initialName = '') => set({ isActive: true, tempPin: null, pendingSpotName: initialName }),
  exit: () => set({ isActive: false, tempPin: null, pendingSpotName: '' }),
  setTempPin: (pos) => set({ tempPin: pos }),
  clearTempPin: () => set({ tempPin: null }),
}));
