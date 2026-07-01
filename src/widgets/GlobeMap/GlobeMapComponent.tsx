import { useRef, useCallback, useState, useMemo, useEffect } from 'react';
import Map, { MapRef, NavigationControl, Source, Layer, Popup, ViewStateChangeEvent, MapMouseEvent } from 'react-map-gl';
import { Loader, Paper, Text } from '@mantine/core';
import 'mapbox-gl/dist/mapbox-gl.css';
import mapboxgl from 'mapbox-gl';

import { Spot } from 'entities/Spot';
import type { LngLat } from 'shared/types/coordinates';
import { useMapStore } from 'widgets/GlobeMap/model/mapStore';
import type { GlobeMotionPolicy } from './model/globeMotionPolicy';
import { useGlobeAnimation } from './hooks/useGlobeAnimation';
import { useSpotGeoJson } from './hooks/useSpotGeoJson';
import { useMapInteraction } from './hooks/useMapInteraction';
import { useMapImages } from './hooks/useMapImages';
import { TempPinMarker } from './ui/TempPinMarker';
import { clusterLayer, clusterCountLayer, getUnclusteredPointLayer, getIconLayer, globeFog, SPOT_INTERACTIVE_LAYERS } from './layerStyles';

import classes from './GlobeMap.module.css';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN as string;
if (!MAPBOX_TOKEN) throw new Error('Missing VITE_MAPBOX_ACCESS_TOKEN');

const DEFAULT_VIEW = {
  longitude: 115.085,
  latitude: -8.815,
  zoom: 1.5,
};

export interface GlobeMapHandle {
  flyTo: (center: [number, number], zoom?: number) => void;
}

interface PendingFocus {
  spotId: string;
  showPreview: boolean;
}

export interface GlobeMapProps {
  spots?: Spot[];
  selectedSpotId?: string | null;
  initialViewState?: {
    longitude: number;
    latitude: number;
    zoom: number;
  };
  onSpotSelect: (spot: Spot) => void;
  motionPolicy: GlobeMotionPolicy;
  isPinPlacementActive?: boolean;
  tempPin?: LngLat | null;
  onMapCoordinateClick?: (coords: LngLat) => void;
  onUserExploreStart?: () => void;
  onUserExploreEnd?: () => void;
}

export function GlobeMapComponent({
  spots = [],
  selectedSpotId = null,
  initialViewState: _initialViewState = DEFAULT_VIEW,
  onSpotSelect,
  motionPolicy,
  isPinPlacementActive = false,
  tempPin = null,
  onMapCoordinateClick,
  onUserExploreStart,
  onUserExploreEnd,
}: GlobeMapProps) {
  const mapRef = useRef<MapRef>(null);
  const mapInstanceRef = useRef<mapboxgl.Map | null>(null);
  const pendingFocusRef = useRef<PendingFocus | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const cameraState = useMapStore((s) => s.cameraState);
  const saveCameraState = useMapStore((s) => s.saveCameraState);

  // On hard nav to a spot URL with no prior session (camera at default Bali position),
  // derive the initial viewport from the spot coords at zoom 12 — same as the soft-nav
  // flyTo would produce. A lazy state initializer captures it once at mount, matching
  // how react-map-gl treats initialViewState (ignored after first render).
  const [{ viewState: resolvedInitialView, focusedSpotId: initialFocusedSpotId }] = useState(() => {
    const isDefaultCamera =
      cameraState.longitude === DEFAULT_VIEW.longitude &&
      cameraState.latitude === DEFAULT_VIEW.latitude;
    if (isDefaultCamera && selectedSpotId) {
      const spot = spots.find((s) => s.id === selectedSpotId);
      if (spot) {
        return {
          viewState: {
            longitude: spot.coords.lng,
            latitude: spot.coords.lat,
            zoom: 12,
            pitch: 0,
            bearing: 0,
          },
          focusedSpotId: spot.id,
        };
      }
    }
    return {
      viewState: cameraState,
      focusedSpotId: null,
    };
  });
  const focusedRouteSpotIdRef = useRef<string | null>(initialFocusedSpotId);

  const {
    startSpinning,
    stopSpinning,
    onUserInteractionStart,
    onUserInteractionEnd,
  } = useGlobeAnimation(mapRef, {
    spinSpeed: 0.3,
    enabled: motionPolicy === 'ambientSpin',
    maxSpinZoom: 3,
  });

  const unclusteredPointLayer = useMemo(
    () => getUnclusteredPointLayer(selectedSpotId),
    [selectedSpotId]
  );
  const iconLayer = useMemo(
    () => getIconLayer(selectedSpotId),
    [selectedSpotId]
  );

  const spotsGeoJson = useSpotGeoJson(spots);
  const { loadImages } = useMapImages(mapRef);

  const executeFocusSpot = useCallback((spot: Spot, showPreview: boolean) => {
    const map = mapInstanceRef.current;
    if (!map) {
      pendingFocusRef.current = { spotId: spot.id, showPreview };
      return;
    }

    const currentZoom = map.getZoom();
    const padding = showPreview ? { top: 300 } : { top: 0 };
    const center: [number, number] = [spot.coords.lng, spot.coords.lat];

    if (currentZoom >= 12) {
      map.easeTo({
        center,
        padding,
        duration: 600,
        essential: true,
      });
      return;
    }

    map.flyTo({
      center,
      zoom: 12,
      padding,
      duration: 1000,
      essential: true,
    });
  }, []);

  const focusSpotById = useCallback((spotId: string, showPreview: boolean) => {
    const spot = spots.find((candidate) => candidate.id === spotId);
    if (!spot) return false;

    executeFocusSpot(spot, showPreview);
    if (mapInstanceRef.current) {
      pendingFocusRef.current = null;
    }
    return true;
  }, [executeFocusSpot, spots]);

  const {
    hoveredSpot,
    cursor,
    onMapClick: onSpotClick,
    onMouseEnter,
    onMouseLeave
  } = useMapInteraction({
    mapRef,
    spots,
    onSpotClick: (spot) => {
      executeFocusSpot(spot, false);
      onSpotSelect(spot);
    },
    onUserInteractionStart: () => {
      onUserExploreStart?.();
      onUserInteractionStart();
    }
  });

  useEffect(() => {
    if (!selectedSpotId) {
      pendingFocusRef.current = null;
      focusedRouteSpotIdRef.current = null;
      return;
    }

    if (focusedRouteSpotIdRef.current === selectedSpotId) return;

    if (focusSpotById(selectedSpotId, true)) {
      focusedRouteSpotIdRef.current = selectedSpotId;
    }
  }, [focusSpotById, selectedSpotId]);

  useEffect(() => {
    return () => {
      mapInstanceRef.current = null;
      pendingFocusRef.current = null;
    };
  }, []);

  const handleMoveEnd = useCallback((e: ViewStateChangeEvent) => {
    const { longitude, latitude, zoom, pitch, bearing } = e.viewState;
    saveCameraState({ longitude, latitude, zoom, pitch, bearing });
    onUserExploreEnd?.();
  }, [onUserExploreEnd, saveCameraState]);

  const handleUserInteractionStart = useCallback(() => {
    onUserExploreStart?.();
    onUserInteractionStart();
  }, [onUserExploreStart, onUserInteractionStart]);

  const handleUserInteractionEnd = useCallback(() => {
    onUserInteractionEnd();
    onUserExploreEnd?.();
  }, [onUserExploreEnd, onUserInteractionEnd]);

  const handleLoad = useCallback((e: mapboxgl.MapboxEvent) => {
    mapInstanceRef.current = e.target as mapboxgl.Map;
    setIsLoaded(true);
    loadImages();

    const pendingFocus = pendingFocusRef.current;
    if (pendingFocus) {
      focusSpotById(pendingFocus.spotId, pendingFocus.showPreview);
    }
  }, [focusSpotById, loadImages]);

  const handleCoordinateClick = useCallback((e: MapMouseEvent) => {
    onMapCoordinateClick?.([e.lngLat.lng, e.lngLat.lat]);
  }, [onMapCoordinateClick]);

  useEffect(() => {
    if (!isLoaded) return;

    if (motionPolicy === 'ambientSpin') {
      startSpinning();
      return;
    }

    stopSpinning();
  }, [isLoaded, motionPolicy, startSpinning, stopSpinning]);

  return (
    <div className={classes.globeContainer}>
      {!isLoaded && (
        <div className={classes.loading}>
          <Loader color="blue" size="lg" />
        </div>
      )}

      <Map
        ref={mapRef}
        cursor={isPinPlacementActive ? 'crosshair' : (selectedSpotId ? 'default' : cursor)}
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={resolvedInitialView}
        onMoveEnd={handleMoveEnd}
        style={{ width: '100%', height: '100%' }}
        mapStyle="mapbox://styles/mapbox/satellite-streets-v12"
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mapbox-gl type for globe projection requires any
        projection={{ name: 'globe' as any }}
        fog={globeFog}
        onLoad={handleLoad}
        onClick={isPinPlacementActive ? handleCoordinateClick : onSpotClick}
        onDragStart={handleUserInteractionStart}
        onDragEnd={handleUserInteractionEnd}
        onZoomStart={handleUserInteractionStart}
        onZoomEnd={handleUserInteractionEnd}
        onRotateStart={handleUserInteractionStart}
        onRotateEnd={handleUserInteractionEnd}
        onMouseDown={handleUserInteractionStart}
        onTouchStart={handleUserInteractionStart}
        onWheel={handleUserInteractionStart}
        interactiveLayerIds={isPinPlacementActive ? [] : SPOT_INTERACTIVE_LAYERS}
        onMouseEnter={isPinPlacementActive ? undefined : onMouseEnter}
        onMouseLeave={isPinPlacementActive ? undefined : onMouseLeave}
        maxZoom={18}
        minZoom={1}
        trackResize={true}
        cooperativeGestures={false}
      >
        <Source
          id="spots"
          type="geojson"
          data={spotsGeoJson}
          cluster={true}
          clusterMaxZoom={11}
          clusterRadius={50}
        >
          <Layer {...clusterLayer} />
          <Layer {...clusterCountLayer} />
          <Layer {...unclusteredPointLayer} />
          <Layer {...iconLayer} />
        </Source>
        {/* Tooltip Popup (Only when not selected) */}
        {hoveredSpot && hoveredSpot.id !== selectedSpotId && (
          <Popup
            longitude={hoveredSpot.coords.lng}
            latitude={hoveredSpot.coords.lat}
            offset={15}
            closeButton={false}
            closeOnClick={false}
            anchor="bottom"
            className={classes.popupTooltip}
          >
            <Paper p="xs" shadow="xs" radius="sm" withBorder>
              <Text size="sm" fw={500}>{hoveredSpot.name}</Text>
            </Paper>
          </Popup>
        )}

        <TempPinMarker tempPin={tempPin} isActive={isPinPlacementActive} />

        <NavigationControl position="bottom-right" />
      </Map>
    </div>
  );
}

export default GlobeMapComponent;
