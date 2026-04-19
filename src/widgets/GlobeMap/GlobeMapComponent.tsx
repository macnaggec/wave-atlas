import { useRef, useCallback, useState, useMemo, ReactNode } from 'react';
import Map, { MapRef, NavigationControl, Source, Layer, Popup, ViewStateChangeEvent } from 'react-map-gl';
import { Loader, Paper, Text } from '@mantine/core';
import 'mapbox-gl/dist/mapbox-gl.css';

import { Spot } from 'entities/Spot/types';
import { useMapStore } from 'widgets/GlobeMap/model/mapStore';
import { useGlobeAnimation } from './hooks/useGlobeAnimation';
import { useSpotGeoJson } from './hooks/useSpotGeoJson';
import { useMapInteraction } from './hooks/useMapInteraction';
import { useMapImages } from './hooks/useMapImages';
import { useSpotFlyTo } from './hooks/useSpotFlyTo';
import { usePinPlacementMode } from './hooks/usePinPlacementMode';
import { TempPinMarker } from './ui/TempPinMarker';
import { clusterLayer, clusterCountLayer, getUnclusteredPointLayer, getIconLayer, globeFog, SPOT_INTERACTIVE_LAYERS } from './layerStyles';
import { getMapControls } from './mapControls';
import classes from './GlobeMap.module.css';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN as string;
if (!MAPBOX_TOKEN) throw new Error('Missing VITE_MAPBOX_ACCESS_TOKEN');

// Default view: Shows most of the world
const DEFAULT_VIEW = {
  longitude: 115.085, // Bali - a great surf destination as default
  latitude: -8.815,
  zoom: 1.5,
};

export type PageMode = 'explore' | 'upload';

export interface GlobeMapHandle {
  // Define methods exposed via ref if any, or common Map usage
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
  /** Render the popup content for a selected spot. Defaults to SpotPreviewCard. */
  renderPopupContent?: (spot: Spot) => ReactNode;
}

export function GlobeMapComponent({
  spots = [],
  initialViewState = DEFAULT_VIEW,
  mode = 'explore',
  initialSpotId,
  onUploadConfirm,
  onUploadCancel,
  renderPopupContent,
}: GlobeMapProps) {
  const mapRef = useRef<MapRef>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const {
    selectedSpotId: activeSpotId,
    selectedSpot: activeSpot,
    selectSpot,
    clearSelection,
    cameraState,
    saveCameraState,
  } = useMapStore();

  const isPinMode = useMapStore((s) => s.interactionMode === 'pin-placement');
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
          longitude: spot.coords[1],
          latitude: spot.coords[0],
          zoom: 12,
          pitch: 0,
          bearing: 0,
        };
      }
    }
    return cameraState;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- initial value only

  const {
    startSpinning,
    onUserInteractionStart,
    onUserInteractionEnd,
  } = useGlobeAnimation(mapRef, {
    spinSpeed: 0.3,
    enabled: !isPinMode,
    maxSpinZoom: 3,
  });

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
    onSpotClick: (spot) => selectSpot(spot),
    onClearSelection: clearSelection,
    onUserInteractionStart
  });

  const { resetPreviewOffset } = useSpotFlyTo({
    mapRef,
    spots,
    isLoaded,
    onUserInteractionStart,
  });

  const handlePopupClose = useCallback(() => {
    resetPreviewOffset();
    clearSelection();
  }, [resetPreviewOffset, clearSelection]);

  const handleMoveEnd = useCallback((e: ViewStateChangeEvent) => {
    const { longitude, latitude, zoom, pitch, bearing } = e.viewState;
    saveCameraState({ longitude, latitude, zoom, pitch, bearing });
  }, [saveCameraState]);

  const handleLoad = useCallback(() => {
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
        {...getMapControls(activeSpotId, mode)}
        trackResize={true}
        cooperativeGestures={false}
      >
        <Source
          id="spots"
          type="geojson"
          data={spotsGeoJson}
          cluster={true}
          clusterMaxZoom={14}
          clusterRadius={50}
        >
          <Layer {...clusterLayer} />
          <Layer {...clusterCountLayer} />
          <Layer {...getUnclusteredPointLayer(activeSpotId)} />
          <Layer {...getIconLayer(activeSpotId)} />
        </Source>
        {/* Tooltip Popup (Only when not selected) */}
        {hoveredSpot && hoveredSpot.id !== activeSpotId && (
          <Popup
            longitude={hoveredSpot.coords[1]}
            latitude={hoveredSpot.coords[0]}
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

        {/* Spot Preview Popup (Interactive) */}
        {activeSpotId && (
          <Popup
            longitude={spots.find(s => s.id === activeSpotId)?.coords[1] || 0}
            latitude={spots.find(s => s.id === activeSpotId)?.coords[0] || 0}
            offset={25}
            closeButton={true}
            closeOnClick={false}
            onClose={handlePopupClose}
            anchor="bottom"
            className={classes.popupGallery}
            maxWidth="320px"
          >
            {activeSpot && renderPopupContent?.(activeSpot)}
          </Popup>
        )}


        <TempPinMarker />

        <NavigationControl position="bottom-right" />
      </Map>
    </div>
  );
}

export default GlobeMapComponent;
