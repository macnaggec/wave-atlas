import type { Spot } from 'entities/Spot/types';
import { cameraService } from './CameraService';

type NavigateFn = (opts: { to: string; params?: Record<string, string> }) => void;

let _navigate: NavigateFn | null = null;

export const mapCommands = {
  /** Called once by GlobeMapComponent on mount to inject the router navigate function. */
  setNavigate(fn: NavigateFn) {
    _navigate = fn;
  },

  selectFromSearch(spot: Spot) {
    cameraService.flyTo(spot, false);
    _navigate?.({ to: '/$spotId', params: { spotId: spot.id } });
  },

  selectFromPin(spot: Spot) {
    cameraService.flyTo(spot, false);
    _navigate?.({ to: '/$spotId', params: { spotId: spot.id } });
  },

  /** Background map click — navigate to root; /$spotId unmount clears selection. */
  clearAll() {
    cameraService.resetPadding();
    _navigate?.({ to: '/' });
  },
};
