import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GlobeMapComponent } from './GlobeMapComponent';
import type { Spot } from 'entities/Spot';

const mocks = vi.hoisted(() => ({
  loadImages: vi.fn(),
  onUserInteractionEnd: vi.fn(),
  onUserInteractionStart: vi.fn(),
  saveCameraState: vi.fn(),
  startSpinning: vi.fn(),
  stopSpinning: vi.fn(),
}));

vi.mock('mapbox-gl', () => ({
  default: {},
}));

vi.mock('react-map-gl', () => ({
  default: ({ children, onLoad }: { children: ReactNode; onLoad: (event: { target: unknown }) => void }) => (
    <button type="button" onClick={() => onLoad({ target: {} })}>
      Load map
      {children}
    </button>
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

vi.mock('entities/Spot', () => ({
  useSelectedSpot: () => ({ spotId: null }),
}));

vi.mock('features/AddSpot', () => ({
  usePinPlacementStore: () => false,
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

vi.mock('./model/CameraService', () => ({
  cameraService: {
    flyTo: vi.fn(),
    register: vi.fn(),
    unregister: vi.fn(),
  },
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
  useMapInteraction: () => ({
    cursor: 'grab',
    hoveredSpot: null,
    onMapClick: vi.fn(),
    onMouseEnter: vi.fn(),
    onMouseLeave: vi.fn(),
  }),
}));

vi.mock('./hooks/useMapImages', () => ({
  useMapImages: () => ({
    loadImages: mocks.loadImages,
  }),
}));

vi.mock('./hooks/usePinPlacementMode', () => ({
  usePinPlacementMode: () => ({
    cursor: 'crosshair',
    onClick: vi.fn(),
  }),
}));

vi.mock('./ui/TempPinMarker', () => ({
  TempPinMarker: () => null,
}));

const spots: Spot[] = [];

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
