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

function setDocumentHidden(hidden: boolean) {
  Object.defineProperty(document, 'hidden', {
    configurable: true,
    value: hidden,
  });
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
    vi.mocked(window.matchMedia).mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    setDocumentHidden(false);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    setDocumentHidden(false);
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

  it('does not queue animation frames while the document is hidden', () => {
    setDocumentHidden(true);
    const mapRef = createMapRef(2);
    const { result } = renderHook(() => useGlobeAnimation(mapRef, { maxSpinZoom: 3 }));

    act(() => result.current.startSpinning());

    expect(requestAnimationFrameMock).not.toHaveBeenCalled();
  });

  it('does not queue animation frames when reduced motion is preferred', () => {
    vi.mocked(window.matchMedia).mockImplementation((query) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    const mapRef = createMapRef(2);
    const { result } = renderHook(() => useGlobeAnimation(mapRef, { maxSpinZoom: 3 }));

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
