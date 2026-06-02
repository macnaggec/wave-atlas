import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Spot } from 'entities/Spot/types';
import type { LngLat } from 'shared/types/coordinates';

export interface CameraState {
  longitude: number;
  latitude: number;
  zoom: number;
  pitch: number;
  bearing: number;
}

const DEFAULT_CAMERA: CameraState = {
  longitude: 115.085,
  latitude: -8.815,
  zoom: 1.5,
  pitch: 0,
  bearing: 0,
};

export type InteractionMode = 'explore' | 'pin-placement' | 'spot-select';

interface MapState {
  selection: Spot | null;
  cameraState: CameraState;
  interactionMode: InteractionMode;
  /** Temporary pin position while in pin-placement mode. */
  tempPin: LngLat | null;
  /** Name pre-filled from the search query that triggered pin-placement. */
  pendingSpotName: string;
}

interface MapActions {
  setSelection: (spot: Spot) => void;
  clearSelection: () => void;
  saveCameraState: (camera: CameraState) => void;
  enterPinPlacement: (initialName?: string) => void;
  exitPinPlacement: () => void;
  enterSpotSelect: () => void;
  exitSpotSelect: () => void;
  setTempPin: (pos: LngLat) => void;
  clearTempPin: () => void;
}

interface MapStore extends MapState, MapActions { }

export const useMapStore = create<MapStore>()(
  persist(
    (set) => ({
      selection: null,
      cameraState: DEFAULT_CAMERA,
      interactionMode: 'explore',
      tempPin: null,
      pendingSpotName: '',

      setSelection: (spot) => set({ selection: spot }),
      clearSelection: () => set({ selection: null }),
      saveCameraState: (camera) => set({ cameraState: camera }),
      enterPinPlacement: (initialName = '') =>
        set({ interactionMode: 'pin-placement', tempPin: null, pendingSpotName: initialName }),
      exitPinPlacement: () =>
        set({ interactionMode: 'explore', tempPin: null, pendingSpotName: '' }),
      enterSpotSelect: () => set({ interactionMode: 'spot-select' }),
      exitSpotSelect: () => set({ interactionMode: 'explore' }),
      setTempPin: (pos) => set({ tempPin: pos }),
      clearTempPin: () => set({ tempPin: null }),
    }),
    {
      name: 'wave-atlas-map',
      storage: createJSONStorage(() => sessionStorage),
      // Only persist camera position — selection and mode reset on every page load
      partialize: (state) => ({ cameraState: state.cameraState }),
    }
  )
);
