import mapboxgl from 'mapbox-gl';
import { Spot } from 'entities/Spot/types';

interface FlyToCmd {
  spot: Spot;
  showPreview: boolean;
}

class CameraService {
  private map: mapboxgl.Map | null = null;
  private pending: FlyToCmd | null = null;

  register(map: mapboxgl.Map): void {
    this.map = map;
    this.flush();
  }

  unregister(): void {
    this.map = null;
  }

  flyTo(spot: Spot, showPreview = true): void {
    if (!this.map) {
      this.pending = { spot, showPreview };
      return;
    }
    this.execute({ spot, showPreview });
  }

  resetPadding(): void {
    if (!this.map) return;
    this.map.easeTo({
      center: this.map.getCenter(),
      padding: { top: 0 },
      duration: 600,
    });
  }

  private execute(cmd: FlyToCmd): void {
    const { spot, showPreview } = cmd;
    const currentZoom = this.map!.getZoom();
    const padding = showPreview ? { top: 300 } : { top: 0 };

    if (currentZoom >= 12) {
      // Already at spot-level zoom — pan only.
      // flyTo changes zoom during animation which causes clusters to
      // collapse and re-expand mid-flight, creating a flicker artifact.
      this.map!.easeTo({
        center: [spot.coords[1], spot.coords[0]],
        padding,
        duration: 600,
        essential: true,
      });
    } else {
      // Zoomed out — fly in to coastal context level.
      this.map!.flyTo({
        center: [spot.coords[1], spot.coords[0]],
        zoom: 12,
        padding,
        duration: 1000,
        essential: true,
      });
    }
    this.pending = null;
  }

  private flush(): void {
    if (this.pending !== null) {
      this.execute(this.pending);
    }
  }
}

export const cameraService = new CameraService();
