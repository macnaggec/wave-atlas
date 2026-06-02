import { Spot } from 'entities/Spot/types';
import { useMapStore } from './mapStore';
import { cameraService } from './CameraService';

export const mapCommands = {
  selectFromSearch(spot: Spot) {
    useMapStore.getState().setSelection(spot);
    cameraService.flyTo(spot, false);
  },

  selectFromPin(spot: Spot) {
    useMapStore.getState().setSelection(spot);
    cameraService.flyTo(spot, false);
  },

  /** Background map click — clear spot selection entirely. */
  clearAll() {
    useMapStore.getState().clearSelection();
    cameraService.resetPadding();
  },

  /** Drawer panel opened (URL with $spotId) — remove map highlight. */
  onPanelOpen() {
    useMapStore.getState().clearSelection();
  },
};
