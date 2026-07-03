import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GlobeMapComponent } from './GlobeMapComponent';
import type { Spot } from 'entities/Spot';
import type { LngLat } from 'shared/types/coordinates';

const mocks = vi.hoisted(() => ({
  loadImages: vi.fn(),
  onUserInteractionEnd: vi.fn(),
  onUserInteractionStart: vi.fn(),
  saveCameraState: vi.fn(),
  startSpinning: vi.fn(),
  stopSpinning: vi.fn(),
  tempPinMarker: vi.fn(),
  flyTo: vi.fn(),
  easeTo: vi.fn(),
  getZoom: vi.fn(() => 1.5),
}));

vi.mock('mapbox-gl', () => ({
  default: {},
}));

vi.mock('react-map-gl', () => ({
  default: ({
    children,
    cursor,
    initialViewState,
    interactiveLayerIds,
    interactive,
    onClick,
    onDragStart,
    onLoad,
    onMouseEnter,
    onMoveEnd,
    onWheel,
    boxZoom,
    doubleClickZoom,
    dragPan,
    dragRotate,
    keyboard,
    scrollZoom,
    touchPitch,
    touchZoomRotate,
  }: {
    children: ReactNode;
    cursor?: string;
    initialViewState?: unknown;
    interactiveLayerIds?: string[];
    interactive?: boolean;
    onClick?: (event: { lngLat: { lng: number; lat: number } }) => void;
    onDragStart?: () => void;
    onLoad: (event: { target: unknown }) => void;
    onMouseEnter?: () => void;
    onMoveEnd?: (event: { viewState: { longitude: number; latitude: number; zoom: number; pitch: number; bearing: number } }) => void;
    onWheel?: () => void;
    boxZoom?: boolean;
    doubleClickZoom?: boolean;
    dragPan?: boolean;
    dragRotate?: boolean;
    keyboard?: boolean;
    scrollZoom?: boolean;
    touchPitch?: boolean;
    touchZoomRotate?: boolean;
  }) => (
    <div>
      <button
        type="button"
        data-initial-view-state={JSON.stringify(initialViewState)}
        onClick={() => onLoad({ target: {
          easeTo: mocks.easeTo,
          flyTo: mocks.flyTo,
          getZoom: mocks.getZoom,
        } })}
      >
        Load map
        {children}
      </button>
      <button
        type="button"
        data-cursor={cursor}
        data-interactive-layers={interactiveLayerIds?.join(',') ?? ''}
        data-interactive={String(interactive)}
        data-map-handlers={[
          boxZoom,
          doubleClickZoom,
          dragPan,
          dragRotate,
          keyboard,
          scrollZoom,
          touchPitch,
          touchZoomRotate,
        ].map(String).join(',')}
        onClick={() => onClick?.({ lngLat: { lng: 151.2, lat: -33.85 } })}
      >
        Click map
      </button>
      <button type="button" onClick={() => onMouseEnter?.()}>
        Enter spot
      </button>
      <button type="button" onClick={() => onDragStart?.()}>
        Drag globe
      </button>
      <button type="button" onClick={() => onWheel?.()}>
        Wheel globe
      </button>
      <button
        type="button"
        onClick={() => onMoveEnd?.({
          viewState: { longitude: 1, latitude: 2, zoom: 3, pitch: 4, bearing: 5 },
        })}
      >
        Move end
      </button>
    </div>
  ),
  Layer: () => null,
  NavigationControl: () => null,
  Popup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Source: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@mantine/core', () => ({
  Loader: () => <div>Loading</div>,
  Paper: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Text: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));

vi.mock('widgets/GlobeMap/model/mapStore', () => ({
  useMapStore: (selector: (state: unknown) => unknown) => selector({
    cameraState: {
      longitude: 115.085,
      latitude: -8.815,
      zoom: 1.5,
      pitch: 0,
      bearing: 0,
    },
    saveCameraState: mocks.saveCameraState,
  }),
}));

vi.mock('./hooks/useGlobeAnimation', () => ({
  useGlobeAnimation: () => ({
    onUserInteractionEnd: mocks.onUserInteractionEnd,
    onUserInteractionStart: mocks.onUserInteractionStart,
    startSpinning: mocks.startSpinning,
    stopSpinning: mocks.stopSpinning,
  }),
}));

vi.mock('./hooks/useSpotGeoJson', () => ({
  useSpotGeoJson: () => ({
    type: 'FeatureCollection',
    features: [],
  }),
}));

vi.mock('./hooks/useMapInteraction', () => ({
  useMapInteraction: ({ spots, onSpotClick }: { spots: Spot[]; onSpotClick?: (spot: Spot) => void }) => ({
    cursor: 'grab',
    hoveredSpot: spots[0] ?? null,
    onMapClick: () => {
      const spot = spots[0];
      if (spot) onSpotClick?.(spot);
    },
    onMouseEnter: vi.fn(),
    onMouseLeave: vi.fn(),
  }),
}));

vi.mock('./hooks/useMapImages', () => ({
  useMapImages: () => ({
    loadImages: mocks.loadImages,
  }),
}));

vi.mock('./ui/TempPinMarker', () => ({
  TempPinMarker: (props: { tempPin: LngLat | null; isActive: boolean }) => {
    mocks.tempPinMarker(props);
    return null;
  },
}));

const spots: Spot[] = [
  {
    id: 'spot-1',
    name: 'Uluwatu',
    location: 'Bali, Indonesia',
    coords: { lng: 115.085, lat: -8.815 },
  },
];

describe('GlobeMapComponent motion policy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts ambient spin on load when the scene requests ambient motion', () => {
    render(<GlobeMapComponent spots={spots} onSpotSelect={vi.fn()} motionPolicy="ambientSpin" />);

    fireEvent.click(screen.getByRole('button', { name: /load map/i }));

    return waitFor(() => {
      expect(mocks.startSpinning).toHaveBeenCalledTimes(1);
    });
  });

  it.each(['paused', 'disabled'] as const)('does not start ambient spin on load when motion is %s', (motionPolicy) => {
    render(<GlobeMapComponent spots={spots} onSpotSelect={vi.fn()} motionPolicy={motionPolicy} />);

    fireEvent.click(screen.getByRole('button', { name: /load map/i }));

    expect(mocks.startSpinning).not.toHaveBeenCalled();
  });
});

describe('GlobeMapComponent pin placement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reports coordinate clicks upward while pin placement is active', () => {
    const onMapCoordinateClick = vi.fn();
    render(
      <GlobeMapComponent
        spots={spots}
        onSpotSelect={vi.fn()}
        motionPolicy="paused"
        isPinPlacementActive={true}
        tempPin={[151, -34]}
        onMapCoordinateClick={onMapCoordinateClick}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /click map/i }));

    expect(onMapCoordinateClick).toHaveBeenCalledWith([151.2, -33.85]);
    expect(screen.getByRole('button', { name: /click map/i })).toHaveAttribute('data-cursor', 'crosshair');
    expect(screen.getByRole('button', { name: /click map/i })).toHaveAttribute('data-interactive-layers', '');
    expect(mocks.tempPinMarker).toHaveBeenCalledWith({ tempPin: [151, -34], isActive: true });
  });
});

describe('GlobeMapComponent interaction policy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('backgrounds the map without accepting spot navigation clicks or hover popups', () => {
    const onSpotSelect = vi.fn();
    render(
      <GlobeMapComponent
        spots={spots}
        onSpotSelect={onSpotSelect}
        motionPolicy="paused"
        interactionPolicy="background"
      />,
    );

    expect(screen.getByRole('button', { name: /click map/i })).toHaveAttribute('data-interactive', 'false');
    expect(screen.getByRole('button', { name: /click map/i })).toHaveAttribute('data-interactive-layers', '');
    expect(screen.getByRole('button', { name: /click map/i })).toHaveAttribute(
      'data-map-handlers',
      'false,false,false,false,false,false,false,false',
    );
    expect(screen.queryByText('Uluwatu')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /click map/i }));

    expect(onSpotSelect).not.toHaveBeenCalled();
    expect(mocks.flyTo).not.toHaveBeenCalled();
  });

  it('keeps Mapbox camera handlers enabled while interactive', () => {
    render(
      <GlobeMapComponent
        spots={spots}
        onSpotSelect={vi.fn()}
        motionPolicy="paused"
        interactionPolicy="interactive"
      />,
    );

    expect(screen.getByRole('button', { name: /click map/i })).toHaveAttribute(
      'data-map-handlers',
      'true,true,true,true,true,true,true,true',
    );
  });

  it('does not report user exploration while backgrounded', () => {
    const onUserExploreStart = vi.fn();
    const onUserExploreEnd = vi.fn();
    render(
      <GlobeMapComponent
        spots={spots}
        onSpotSelect={vi.fn()}
        motionPolicy="paused"
        interactionPolicy="background"
        onUserExploreStart={onUserExploreStart}
        onUserExploreEnd={onUserExploreEnd}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /drag globe/i }));
    fireEvent.click(screen.getByRole('button', { name: /wheel globe/i }));
    fireEvent.click(screen.getByRole('button', { name: /move end/i }));

    expect(onUserExploreStart).not.toHaveBeenCalled();
    expect(onUserExploreEnd).not.toHaveBeenCalled();
  });
});

describe('GlobeMapComponent selected spot focus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getZoom.mockReturnValue(1.5);
  });

  it('runs a pending route focus after the map loads', async () => {
    const { rerender } = render(
      <GlobeMapComponent
        spots={spots}
        selectedSpotId={null}
        onSpotSelect={vi.fn()}
        motionPolicy="paused"
      />,
    );

    rerender(
      <GlobeMapComponent
        spots={spots}
        selectedSpotId="spot-1"
        onSpotSelect={vi.fn()}
        motionPolicy="paused"
      />,
    );
    expect(mocks.flyTo).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /load map/i }));

    await waitFor(() => {
      expect(mocks.flyTo).toHaveBeenCalledWith({
        center: [115.085, -8.815],
        zoom: 12,
        padding: { top: 300 },
        duration: 1000,
        essential: true,
      });
    });
  });

  it('focuses a newly selected route spot once after the map has loaded', () => {
    const { rerender } = render(
      <GlobeMapComponent
        spots={spots}
        selectedSpotId={null}
        onSpotSelect={vi.fn()}
        motionPolicy="paused"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /load map/i }));

    rerender(
      <GlobeMapComponent
        spots={spots}
        selectedSpotId="spot-1"
        onSpotSelect={vi.fn()}
        motionPolicy="paused"
      />,
    );

    expect(mocks.flyTo).toHaveBeenCalledTimes(1);
    expect(mocks.flyTo).toHaveBeenCalledWith({
      center: [115.085, -8.815],
      zoom: 12,
      padding: { top: 300 },
      duration: 1000,
      essential: true,
    });

    rerender(
      <GlobeMapComponent
        spots={spots}
        selectedSpotId="spot-1"
        onSpotSelect={vi.fn()}
        motionPolicy="disabled"
      />,
    );

    expect(mocks.flyTo).toHaveBeenCalledTimes(1);
  });

  it('focuses a selected route spot when its spot record arrives after map load', () => {
    const { rerender } = render(
      <GlobeMapComponent
        spots={[]}
        selectedSpotId="spot-1"
        onSpotSelect={vi.fn()}
        motionPolicy="paused"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /load map/i }));
    expect(mocks.flyTo).not.toHaveBeenCalled();

    rerender(
      <GlobeMapComponent
        spots={spots}
        selectedSpotId="spot-1"
        onSpotSelect={vi.fn()}
        motionPolicy="paused"
      />,
    );

    expect(mocks.flyTo).toHaveBeenCalledWith({
      center: [115.085, -8.815],
      zoom: 12,
      padding: { top: 300 },
      duration: 1000,
      essential: true,
    });
  });

  it('focuses a selected route spot when its spot record arrives before map load', async () => {
    const { rerender } = render(
      <GlobeMapComponent
        spots={[]}
        selectedSpotId="spot-1"
        onSpotSelect={vi.fn()}
        motionPolicy="paused"
      />,
    );

    rerender(
      <GlobeMapComponent
        spots={spots}
        selectedSpotId="spot-1"
        onSpotSelect={vi.fn()}
        motionPolicy="paused"
      />,
    );
    expect(mocks.flyTo).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /load map/i }));

    await waitFor(() => {
      expect(mocks.flyTo).toHaveBeenCalledWith({
        center: [115.085, -8.815],
        zoom: 12,
        padding: { top: 300 },
        duration: 1000,
        essential: true,
      });
    });
  });

  it('does not let an earlier local click suppress a later route focus to the same spot', () => {
    const { rerender } = render(
      <GlobeMapComponent
        spots={spots}
        selectedSpotId={null}
        onSpotSelect={vi.fn()}
        motionPolicy="paused"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /load map/i }));
    fireEvent.click(screen.getByRole('button', { name: /click map/i }));

    expect(mocks.flyTo).toHaveBeenCalledWith({
      center: [115.085, -8.815],
      zoom: 12,
      padding: { top: 0 },
      duration: 1000,
      essential: true,
    });
    mocks.flyTo.mockClear();

    rerender(
      <GlobeMapComponent
        spots={spots}
        selectedSpotId="spot-1"
        onSpotSelect={vi.fn()}
        motionPolicy="paused"
      />,
    );

    expect(mocks.flyTo).toHaveBeenCalledWith({
      center: [115.085, -8.815],
      zoom: 12,
      padding: { top: 300 },
      duration: 1000,
      essential: true,
    });
  });

  it('moves the camera to a clicked spot before reporting selection', () => {
    const onSpotSelect = vi.fn();
    render(
      <GlobeMapComponent
        spots={spots}
        selectedSpotId={null}
        onSpotSelect={onSpotSelect}
        motionPolicy="paused"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /load map/i }));
    fireEvent.click(screen.getByRole('button', { name: /click map/i }));

    expect(mocks.flyTo).toHaveBeenCalledWith({
      center: [115.085, -8.815],
      zoom: 12,
      padding: { top: 0 },
      duration: 1000,
      essential: true,
    });
    expect(onSpotSelect).toHaveBeenCalledWith(spots[0]);
    const flyToCallOrder = mocks.flyTo.mock.invocationCallOrder[0];
    const selectionCallOrder = onSpotSelect.mock.invocationCallOrder[0];
    expect(flyToCallOrder).toBeDefined();
    expect(selectionCallOrder).toBeDefined();
    expect(flyToCallOrder!).toBeLessThan(selectionCallOrder!);
  });
});
