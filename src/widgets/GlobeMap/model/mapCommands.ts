import type { Spot } from 'entities/Spot/types';
import { cameraService } from './CameraService';
import { router } from 'app/lib/router';

export const mapCommands = {
  selectFromSearch(spot: Spot) {
    cameraService.flyTo(spot, false);
    void router.navigate({ to: '/$spotId', params: { spotId: spot.id } });
  },

  selectFromPin(spot: Spot) {
    cameraService.flyTo(spot, false);
    void router.navigate({ to: '/$spotId', params: { spotId: spot.id } });
  },

  /** Background map click — navigate to root; /$spotId unmount clears selection. */
  clearAll() {
    cameraService.resetPadding();
    void router.navigate({ to: '/' });
  },
};
