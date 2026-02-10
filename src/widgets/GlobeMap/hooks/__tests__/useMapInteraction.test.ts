import { renderHook, act } from '@testing-library/react';
import { useMapInteraction } from '../useMapInteraction';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MapRef, GeoJSONSource } from 'react-map-gl';
import { Spot } from 'entities/Spot/types';

// Mock types
const mockMapRef = {
  current: {
    getMap: vi.fn(),
  } as unknown as MapRef,
};

const mockMapInstance = {
  easeTo: vi.fn(),
  getSource: vi.fn(),
  getZoom: vi.fn(() => 10),
  getCenter: vi.fn(() => ({ lng: 1, lat: 2 })),
};

const mockGeoJSONSource = {
  getClusterExpansionZoom: vi.fn(),
};

describe('useMapInteraction', () => {
  const mockSpots: Spot[] = [
    {
      id: 'spot-1',
      name: 'Surfers Paradise',
      location: 'Australia',
      coords: [10, 20], // lat, lng
    },
  ];
  const mockOnSpotClick = vi.fn();
  const mockOnClearSelection = vi.fn();
  const mockOnUserInteractionStart = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockMapRef.current = {
      getMap: vi.fn(() => mockMapInstance),
    } as unknown as MapRef;
    mockMapInstance.getSource.mockReturnValue(mockGeoJSONSource);
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() =>
      useMapInteraction({
        mapRef: mockMapRef,
        spots: mockSpots,
        onSpotClick: mockOnSpotClick,
        onClearSelection: mockOnClearSelection,
        onUserInteractionStart: mockOnUserInteractionStart,
      })
    );

    expect(result.current.hoveredSpot).toBeNull();
    expect(result.current.cursor).toBe('');
  });

  describe('handleBackgroundClick', () => {
    it('should reset map padding and clear selection on background click', () => {
      const { result } = renderHook(() =>
        useMapInteraction({
          mapRef: mockMapRef,
          spots: mockSpots,
          onSpotClick: mockOnSpotClick,
          onClearSelection: mockOnClearSelection,
          onUserInteractionStart: mockOnUserInteractionStart,
        })
      );

      // Simulate background click
      act(() => {
        result.current.onMapClick({
          features: [],
        } as any);
      });

      expect(mockOnUserInteractionStart).toHaveBeenCalled();
      expect(mockMapInstance.easeTo).toHaveBeenCalledWith(
        expect.objectContaining({
          center: { lng: 1, lat: 2 },
          padding: { top: 0 },
        })
      );
      expect(mockOnClearSelection).toHaveBeenCalled();
    });
  });

  describe('handleClusterClick', () => {
    it('should zoom into cluster on click', () => {
      const { result } = renderHook(() =>
        useMapInteraction({
          mapRef: mockMapRef,
          spots: mockSpots,
          onSpotClick: mockOnSpotClick,
          onClearSelection: mockOnClearSelection,
          onUserInteractionStart: mockOnUserInteractionStart,
        })
      );

      mockGeoJSONSource.getClusterExpansionZoom.mockImplementation((id, cb) => cb(null, 15));

      act(() => {
        result.current.onMapClick({
          features: [
            {
              properties: { cluster_id: 123 },
              geometry: { type: 'Point', coordinates: [30, 40] },
            },
          ],
        } as any);
      });

      expect(mockGeoJSONSource.getClusterExpansionZoom).toHaveBeenCalledWith(123, expect.any(Function));
      expect(mockMapInstance.easeTo).toHaveBeenCalledWith(
        expect.objectContaining({
          center: [30, 40],
          zoom: 15,
        })
      );
    });
  });

  describe('handleSpotClick', () => {
    it('should call onSpotClick when spot feature clicked', () => {
      const { result } = renderHook(() =>
        useMapInteraction({
          mapRef: mockMapRef,
          spots: mockSpots,
          onSpotClick: mockOnSpotClick,
          onClearSelection: mockOnClearSelection,
          onUserInteractionStart: mockOnUserInteractionStart,
        })
      );

      act(() => {
        result.current.onMapClick({
          features: [
            {
              properties: { id: 'spot-1' },
              geometry: { type: 'Point', coordinates: [20, 10] }, // lng, lat
            },
          ],
        } as any);
      });

      expect(mockOnSpotClick).toHaveBeenCalledWith(mockSpots[0]);
    });
  });
});
