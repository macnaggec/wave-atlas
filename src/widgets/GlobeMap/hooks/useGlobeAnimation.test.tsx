import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MapRef } from 'react-map-gl';
import { useGlobeAnimation } from './useGlobeAnimation';

function createMapRef(zoom: number): React.RefObject<MapRef | null> {
  return {
    current: {
      getMap: () => ({
        getZoom: () => zoom,
        getCenter: () => ({ lng: 10, lat: 20 }),
        setCenter: vi.fn(),
        isMoving: () => false,
      }),
    } as unknown as MapRef,
  };
}

describe('useGlobeAnimation', () => {
  const requestAnimationFrameMock = vi.fn(() => 1);
  const cancelAnimationFrameMock = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    requestAnimationFrameMock.mockClear();
    cancelAnimationFrameMock.mockClear();
    vi.stubGlobal('requestAnimationFrame', requestAnimationFrameMock);
    vi.stubGlobal('cancelAnimationFrame', cancelAnimationFrameMock);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('does not queue another animation frame when the globe is zoomed in', () => {
    const mapRef = createMapRef(4);
    const { result } = renderHook(() => useGlobeAnimation(mapRef, { maxSpinZoom: 3 }));

    act(() => result.current.startSpinning());

    expect(requestAnimationFrameMock).not.toHaveBeenCalled();
  });

  it('cancels the queued animation frame when spinning stops', () => {
    const mapRef = createMapRef(2);
    const { result } = renderHook(() => useGlobeAnimation(mapRef, { maxSpinZoom: 3 }));

    act(() => result.current.startSpinning());
    act(() => result.current.stopSpinning());

    expect(cancelAnimationFrameMock).toHaveBeenCalledWith(1);
  });

  it('does not queue animation frames when animation is disabled', () => {
    const mapRef = createMapRef(2);
    const { result } = renderHook(() => useGlobeAnimation(mapRef, { enabled: false, maxSpinZoom: 3 }));

    act(() => result.current.startSpinning());

    expect(requestAnimationFrameMock).not.toHaveBeenCalled();
  });

  it('cancels pending resume work when animation becomes disabled', () => {
    const mapRef = createMapRef(2);
    const { result, rerender } = renderHook(
      ({ enabled }) => useGlobeAnimation(mapRef, { enabled, maxSpinZoom: 3 }),
      { initialProps: { enabled: true } },
    );

    act(() => result.current.onUserInteractionEnd());
    rerender({ enabled: false });
    act(() => vi.advanceTimersByTime(3000));

    expect(requestAnimationFrameMock).not.toHaveBeenCalled();
  });
});
