'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { MapRef } from 'react-map-gl';

interface UseGlobeAnimationOptions {
  /** Rotation speed in degrees per second */
  spinSpeed?: number;
  /** Whether animation should be running */
  enabled?: boolean;
  /** Maximum zoom level at which spinning is allowed (default: 3) */
  maxSpinZoom?: number;
}

/**
 * Hook to manage slow spinning globe animation
 * Pauses on user interaction and resumes after inactivity
 * Only spins when zoomed out beyond maxSpinZoom threshold
 */
export function useGlobeAnimation(
  mapRef: React.RefObject<MapRef | null>,
  options: UseGlobeAnimationOptions = {}
) {
  const { spinSpeed = 0.5, enabled = true, maxSpinZoom = 3 } = options;

  const isSpinningRef = useRef(true);
  const userInteractingRef = useRef(false);
  const spinTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const spinGlobe = useCallback(() => {
    // Immediate check before any frame logic
    if (userInteractingRef.current || !isSpinningRef.current || !mapRef.current) {
      return;
    }

    const map = mapRef.current.getMap();
    if (!map) return;

    // Check if map is currently moving/zooming/rotating by user
    if (map.isMoving() && userInteractingRef.current) {
      return;
    }

    const currentZoom = map.getZoom();

    // Only spin when zoomed out beyond threshold
    if (currentZoom > maxSpinZoom) {
      requestAnimationFrame(spinGlobe); // Keep loop alive but don't rotate
      return;
    }

    const center = map.getCenter();
    center.lng -= spinSpeed / 60;
    map.setCenter(center);

    requestAnimationFrame(spinGlobe);
  }, [mapRef, spinSpeed, maxSpinZoom]);

  const startSpinning = useCallback(() => {
    if (!enabled) return;
    // Don't start if user is interacting
    if (userInteractingRef.current) return;

    isSpinningRef.current = true;
    spinGlobe();
  }, [enabled, spinGlobe]);

  const stopSpinning = useCallback(() => {
    isSpinningRef.current = false;
  }, []);

  const onUserInteractionStart = useCallback(() => {
    userInteractingRef.current = true;
    isSpinningRef.current = false; // Force stop flag

    if (spinTimeoutRef.current) {
      clearTimeout(spinTimeoutRef.current);
    }
  }, []);

  const onUserInteractionEnd = useCallback(() => {
    userInteractingRef.current = false;

    // Resume spinning after 3 seconds of inactivity, only if zoomed out
    spinTimeoutRef.current = setTimeout(() => {
      if (enabled && mapRef.current) {
        const currentZoom = mapRef.current.getMap().getZoom();
        if (currentZoom <= maxSpinZoom) {
          startSpinning();
        }
      }
    }, 3000);
  }, [enabled, startSpinning, mapRef, maxSpinZoom]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (spinTimeoutRef.current) {
        clearTimeout(spinTimeoutRef.current);
      }
    };
  }, []);

  return {
    startSpinning,
    stopSpinning,
    onUserInteractionStart,
    onUserInteractionEnd,
  };
}
