import React, { forwardRef, useEffect, useImperativeHandle } from 'react';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';

let mockMap: {
  getCenter: ReturnType<typeof vi.fn>;
  easeTo: ReturnType<typeof vi.fn>;
  flyTo: ReturnType<typeof vi.fn>;
  getZoom: ReturnType<typeof vi.fn>;
  loadImage: ReturnType<typeof vi.fn>;
  hasImage: ReturnType<typeof vi.fn>;
  addImage: ReturnType<typeof vi.fn>;
  isMoving: ReturnType<typeof vi.fn>;
  setCenter: ReturnType<typeof vi.fn>;
};

vi.mock('react-map-gl', async () => {
  const Map = forwardRef<any, any>((props, ref) => {
    useImperativeHandle(ref, () => ({
      getMap: () => mockMap,
    }));

    useEffect(() => {
      props.onLoad?.();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return <div data-testid="map">{props.children}</div>;
  });

  const Stub = ({ children }: any) => <div>{children}</div>;

  return {
    __esModule: true,
    default: Map,
    MapRef: {} as any,
    NavigationControl: Stub,
    Source: Stub,
    Layer: Stub,
    Popup: Stub,
  };
});

describe('GlobeMapComponent - padding reset regression', () => {
  beforeAll(() => {
    // Must be set before importing GlobeMapComponent (token read at module init)
    process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN = 'test-token';
  });

  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', () => 0);

    mockMap = {
      getCenter: vi.fn(() => ({ lng: 10, lat: 20 })),
      easeTo: vi.fn(),
      flyTo: vi.fn(),
      getZoom: vi.fn(() => 2),
      loadImage: vi.fn((_url: string, cb: (error?: unknown, image?: unknown) => void) => cb(null, {})),
      hasImage: vi.fn(() => false),
      addImage: vi.fn(),
      isMoving: vi.fn(() => false),
      setCenter: vi.fn(),
    };
  });

  it('clears top padding when selectedSpotId becomes null', async () => {
    const { GlobeMapComponent } = await import('../GlobeMapComponent');

    const spot = {
      id: 'spot-1',
      name: 'Test Spot',
      location: 'Test',
      coords: [1, 2] as [number, number],
    };

    const { rerender } = render(
      <MantineProvider>
        <GlobeMapComponent
          spots={[spot]}
          selectedSpotId="spot-1"
          onSpotSelect={vi.fn()}
          onClosePreview={vi.fn()}
        />
      </MantineProvider>
    );

    await waitFor(() => {
      expect(mockMap.flyTo).toHaveBeenCalled();
    });

    rerender(
      <MantineProvider>
        <GlobeMapComponent
          spots={[spot]}
          selectedSpotId={null}
          onSpotSelect={vi.fn()}
          onClosePreview={vi.fn()}
        />
      </MantineProvider>
    );

    await waitFor(() => {
      expect(mockMap.easeTo).toHaveBeenCalledWith(
        expect.objectContaining({
          center: { lng: 10, lat: 20 },
          padding: { top: 0 },
        })
      );
    });
  });
});
