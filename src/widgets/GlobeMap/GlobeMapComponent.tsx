'use client';

import { useRef, useCallback, useState, useEffect } from 'react';
import Map, { MapRef, NavigationControl, Source, Layer, Popup } from 'react-map-gl';
import { Loader, Paper, Text } from '@mantine/core';
import 'mapbox-gl/dist/mapbox-gl.css';

import { Spot } from 'entities/Spot/types';
import { SpotPreviewCard } from 'features/SpotPreview';
import { useGlobeAnimation } from './hooks/useGlobeAnimation';
import { useSpotGeoJson } from './hooks/useSpotGeoJson';
import { useMapInteraction } from './hooks/useMapInteraction';
import { useMapImages } from './hooks/useMapImages';
import { clusterLayer, clusterCountLayer, getUnclusteredPointLayer, getIconLayer, globeFog } from './layerStyles';
import classes from './GlobeMap.module.css';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

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
  selectedSpotId?: string | null;
  onSpotSelect?: (spot: Spot) => void;
  onClosePreview?: () => void;
  initialViewState?: {
    longitude: number;
    latitude: number;
    zoom: number;
  };
  mode?: PageMode;
  onUploadConfirm?: (spot: Spot) => void;
  onUploadCancel?: () => void;
}

export function GlobeMapComponent({
  spots = [],
  selectedSpotId,
  onSpotSelect,
  onClosePreview,
  initialViewState = DEFAULT_VIEW,
  mode = 'explore',
  onUploadConfirm,
  onUploadCancel
}: GlobeMapProps) {
  const mapRef = useRef<MapRef>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const activeSpotId = selectedSpotId ?? null;

  const {
    startSpinning,
    onUserInteractionStart,
    onUserInteractionEnd,
  } = useGlobeAnimation(mapRef, {
    spinSpeed: 0.3,
    enabled: true,
    maxSpinZoom: 3,
  });

  const spotsGeoJson = useSpotGeoJson(spots);
  const { loadImages } = useMapImages(mapRef);

  const {
    hoveredSpot,
    cursor,
    resetPreviewOffset,
    onMapClick,
    onMouseEnter,
    onMouseLeave
  } = useMapInteraction({
    mapRef,
    spots,
    onSpotClick: onSpotSelect,
    onClearSelection: onClosePreview,
    onUserInteractionStart
  });

  const handlePopupClose = useCallback(() => {
    resetPreviewOffset();
    onClosePreview?.();
  }, [resetPreviewOffset, onClosePreview]);

  const handleLoad = useCallback(() => {
    setIsLoaded(true);
    loadImages();
    startSpinning();
  }, [startSpinning, loadImages]);

  useEffect(() => {
    if (!isLoaded) return;

    if (!activeSpotId) {
      resetPreviewOffset();
      return;
    }

    const spot = spots.find(s => s.id === activeSpotId);
    if (!spot || !mapRef.current) return;

    const map = mapRef.current.getMap();
    map.flyTo({
      center: [spot.coords[1], spot.coords[0]],
      zoom: Math.max(map.getZoom(), 12),
      padding: { top: 300 },
      duration: 1500,
      essential: true
    });

    onUserInteractionStart();
  }, [activeSpotId, spots, isLoaded, resetPreviewOffset, onUserInteractionStart]);

  if (!MAPBOX_TOKEN) {
    return (
      <div className={classes.globeContainer}>
        <div className={classes.loading}>
          <span className={classes.errorText}>
            Missing NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN environment variable
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={classes.globeContainer}>
      {!isLoaded && (
        <div className={classes.loading}>
          <Loader color="blue" size="lg" />
        </div>
      )}

      <Map
        ref={mapRef}
        cursor={activeSpotId ? 'default' : cursor}
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={initialViewState}
        style={{ width: '100%', height: '100%' }}
        mapStyle="mapbox://styles/mapbox/satellite-streets-v12"
        projection={{ name: 'globe' as any }}
        fog={globeFog}
        onLoad={handleLoad}
        onClick={onMapClick}
        onDragStart={onUserInteractionStart}
        onDragEnd={onUserInteractionEnd}
        onZoomStart={onUserInteractionStart}
        onZoomEnd={onUserInteractionEnd}
        onRotateStart={onUserInteractionStart}
        onRotateEnd={onUserInteractionEnd}
        onMouseDown={onUserInteractionStart}
        onTouchStart={onUserInteractionStart}
        onWheel={onUserInteractionStart}
        interactiveLayerIds={['clusters', 'unclustered-point', 'unclustered-point-icon']}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        maxZoom={18}
        minZoom={1}
        dragPan={!activeSpotId}
        dragRotate={!activeSpotId}
        scrollZoom={!activeSpotId}
        touchPitch={!activeSpotId}
        touchZoomRotate={!activeSpotId}
        doubleClickZoom={!activeSpotId}
        keyboard={!activeSpotId}
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
            <SpotPreviewCard spotId={activeSpotId as string} />
          </Popup>
        )}


        <NavigationControl position="bottom-right" />
      </Map>
    </div>
  );
}

export default GlobeMapComponent;
