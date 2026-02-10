/**
 * Geographic coordinates in [longitude, latitude] format (Mapbox standard)
 * Note: Mapbox uses [lng, lat] while Leaflet used [lat, lng]
 */
export type LngLat = [lng: number, lat: number];

/**
 * Geographic coordinates as object (alternative format)
 */
export interface LngLatLike {
  lng: number;
  lat: number;
}

/**
 * Convert [lat, lng] array (legacy Leaflet format) to [lng, lat] (Mapbox format)
 */
export function toMapboxCoords(latLng: [number, number]): LngLat {
  return [latLng[1], latLng[0]];
}

/**
 * Convert [lng, lat] (Mapbox) to [lat, lng] (legacy format)
 */
export function fromMapboxCoords(lngLat: LngLat): [number, number] {
  return [lngLat[1], lngLat[0]];
}
