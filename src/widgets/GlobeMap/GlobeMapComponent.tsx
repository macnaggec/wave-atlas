import { useRef, useCallback, useState, useMemo, useEffect } from 'react';
import Map, { MapRef, NavigationControl, Source, Layer, Popup, ViewStateChangeEvent } from 'react-map-gl';
import { Loader, Paper, Text } from '@mantine/core';
import 'mapbox-gl/dist/mapbox-gl.css';
import mapboxgl from 'mapbox-gl';

import { Spot } from 'entities/Spot/types';
import { useMapStore } from 'widgets/GlobeMap/model/mapStore';
import { mapCommands } from './model/mapCommands';
import { cameraService } from './model/CameraService';
import { useGlobeAnimation } from './hooks/useGlobeAnimation';
import { useSpotGeoJson } from './hooks/useSpotGeoJson';
import { useMapInteraction } from './hooks/useMapInteraction';
import { useMapImages } from './hooks/useMapImages';
import { usePinPlacementMode } from './hooks/usePinPlacementMode';
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

export type PageMode = 'explore' | 'upload';

export interface GlobeMapHandle {
  flyTo: (center: [number, number], zoom?: number) => void;
}

export interface GlobeMapProps {
  spots?: Spot[];
  initialViewState?: {
    longitude: number;
    latitude: number;
    zoom: number;
  };
  mode?: PageMode;
  initialSpotId?: string;
  onUploadConfirm?: (spot: Spot) => void;
  onUploadCancel?: () => void;
}

export function GlobeMapComponent({
  spots = [],
  initialViewState = DEFAULT_VIEW,
  mode = 'explore',
  initialSpotId,
  onUploadConfirm,
  onUploadCancel,
}: GlobeMapProps) {
  const mapRef = useRef<MapRef>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const activeSpot = useMapStore((s) => s.selection);
  const activeSpotId = activeSpot?.id ?? null;
  const cameraState = useMapStore((s) => s.cameraState);
  const saveCameraState = useMapStore((s) => s.saveCameraState);

  const interactionMode = useMapStore((s) => s.interactionMode);
  const isPinMode = interactionMode === 'pin-placement';
  const { onClick: handlePinClick, cursor: pinCursor } = usePinPlacementMode();

  // On hard nav to a spot URL with no prior session (camera at default Bali position),
  // derive the initial viewport from the spot coords at zoom 12 — same as the soft-nav
  // flyTo would produce. useMemo with [] so it's computed once at mount, matching how
  // react-map-gl treats initialViewState (ignored after first render).
  const resolvedInitialView = useMemo(() => {
    const isDefaultCamera =
      cameraState.longitude === DEFAULT_VIEW.longitude &&
      cameraState.latitude === DEFAULT_VIEW.latitude;
    if (isDefaultCamera && initialSpotId) {
      const spot = spots.find((s) => s.id === initialSpotId);
      if (spot) {
        return {
          longitude: spot.coords.lng,
          latitude: spot.coords.lat,
          zoom: 12,
          pitch: 0,
          bearing: 0,
        };
      }
    }
    return cameraState;
  }, []); // intentional: captured once as initial camera state

  const {
    startSpinning,
    onUserInteractionStart,
    onUserInteractionEnd,
  } = useGlobeAnimation(mapRef, {
    spinSpeed: 0.3,
    enabled: !isPinMode,
    maxSpinZoom: 3,
  });

  const unclusteredPointLayer = useMemo(
    () => getUnclusteredPointLayer(activeSpotId),
    [activeSpotId]
  );
  const iconLayer = useMemo(
    () => getIconLayer(activeSpotId),
    [activeSpotId]
  );

  const spotsGeoJson = useSpotGeoJson(spots);
  const { loadImages } = useMapImages(mapRef);

  const {
    hoveredSpot,
    cursor,
    onMapClick: onSpotClick,
    onMouseEnter,
    onMouseLeave
  } = useMapInteraction({
    mapRef,
    spots,
    onSpotClick: (spot) => mapCommands.selectFromPin(spot),
    onUserInteractionStart
  });

  useEffect(() => {
    return () => cameraService.unregister();
  }, []);

  const handleMoveEnd = useCallback((e: ViewStateChangeEvent) => {
    const { longitude, latitude, zoom, pitch, bearing } = e.viewState;
    saveCameraState({ longitude, latitude, zoom, pitch, bearing });
  }, [saveCameraState]);

  const handleLoad = useCallback((e: mapboxgl.MapboxEvent) => {
    cameraService.register(e.target);
    setIsLoaded(true);
    loadImages();
    startSpinning();
  }, [startSpinning, loadImages]);

  return (
    <div className={classes.globeContainer}>
      {!isLoaded && (
        <div className={classes.loading}>
          <Loader color="blue" size="lg" />
        </div>
      )}

      <Map
        ref={mapRef}
        cursor={isPinMode ? pinCursor : (activeSpotId ? 'default' : cursor)}
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={resolvedInitialView}
        onMoveEnd={handleMoveEnd}
        style={{ width: '100%', height: '100%' }}
        mapStyle="mapbox://styles/mapbox/satellite-streets-v12"
        projection={{ name: 'globe' as any }}
        fog={globeFog}
        onLoad={handleLoad}
        onClick={isPinMode ? handlePinClick : onSpotClick}
        onDragStart={onUserInteractionStart}
        onDragEnd={onUserInteractionEnd}
        onZoomStart={onUserInteractionStart}
        onZoomEnd={onUserInteractionEnd}
        onRotateStart={onUserInteractionStart}
        onRotateEnd={onUserInteractionEnd}
        onMouseDown={onUserInteractionStart}
        onTouchStart={onUserInteractionStart}
        onWheel={onUserInteractionStart}
        interactiveLayerIds={isPinMode ? [] : SPOT_INTERACTIVE_LAYERS}
        onMouseEnter={isPinMode ? undefined : onMouseEnter}
        onMouseLeave={isPinMode ? undefined : onMouseLeave}
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
        {hoveredSpot && hoveredSpot.id !== activeSpotId && (
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

        <TempPinMarker />

        <NavigationControl position="bottom-right" />
      </Map>
    </div>
  );
}

export default GlobeMapComponent;
