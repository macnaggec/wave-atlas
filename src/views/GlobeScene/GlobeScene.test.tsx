import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GlobeScene } from './GlobeScene';
import type { LngLat } from 'shared/types/coordinates';

const mocks = vi.hoisted(() => ({
  invalidateQueries: vi.fn(),
  isUpdatingDraft: false,
  matches: [{ routeId: '/_panel/upload', search: { draftId: 'draft-1' } }] as Array<{
    routeId: string;
    params?: { spotId?: string };
    search?: { draftId?: string };
  }>,
  navigate: vi.fn(),
  notifyError: vi.fn(),
  pinPlacementState: {
    isActive: false,
    tempPin: null as LngLat | null,
    setTempPin: vi.fn(),
  },
  updateDraft: vi.fn(),
}));

vi.mock('widgets/GlobeMap', () => ({
  GlobeMap: ({
    isPinPlacementActive,
    onMapCoordinateClick,
    onSpotSelect,
    selectedSpotId,
    tempPin,
    ...restProps
  }: {
    isPinPlacementActive?: boolean;
    onMapCoordinateClick?: (coords: LngLat) => void;
    onSpotSelect: (spot: { id: string }) => void;
    selectedSpotId?: string | null;
    tempPin?: LngLat | null;
  }) => (
    <div
      data-pin-active={String(isPinPlacementActive)}
      data-temp-pin={tempPin?.join(',') ?? ''}
      data-selected-spot-id={selectedSpotId ?? ''}
      data-has-camera-intent={String('cameraIntent' in restProps)}
    >
      <button onClick={() => onSpotSelect({ id: 'spot-1' })}>Select Pipeline</button>
      <button onClick={() => onMapCoordinateClick?.([151.2, -33.85])}>Place pin</button>
    </div>
  ),
}));

vi.mock('entities/Spot', () => ({
  useMapSpots: () => ({ data: [] }),
}));

vi.mock('features/AddSpot', () => ({
  AddSpotPanel: () => <div>Add spot panel</div>,
  usePinPlacementStore: (selector: (state: typeof mocks.pinPlacementState) => unknown) =>
    selector(mocks.pinPlacementState),
}));

vi.mock('@tanstack/react-query', () => ({
  useMutation: () => ({
    mutateAsync: mocks.updateDraft,
    isPending: mocks.isUpdatingDraft,
  }),
  useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
}));

vi.mock('@tanstack/react-router', () => ({
  useMatches: () => mocks.matches,
  useNavigate: () => mocks.navigate,
}));

vi.mock('shared/lib/trpc', () => ({
  useTRPC: () => ({
    sessions: {
      updateDraft: { mutationOptions: vi.fn() },
      draft: { queryKey: (draftId: string) => ['sessions', 'draft', draftId] },
    },
  }),
}));

vi.mock('shared/lib/notifications', () => ({
  notify: { error: mocks.notifyError },
}));

describe('GlobeScene upload spot selection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isUpdatingDraft = false;
    mocks.matches = [{ routeId: '/_panel/upload', search: { draftId: 'draft-1' } }];
    mocks.pinPlacementState.isActive = false;
    mocks.pinPlacementState.tempPin = null;
  });

  it('shows the photographer when saving the selected spot fails', async () => {
    mocks.updateDraft.mockRejectedValue(new Error('Network down'));
    render(<GlobeScene />);

    fireEvent.click(screen.getByRole('button', { name: 'Select Pipeline' }));

    await waitFor(() => {
      expect(mocks.notifyError).toHaveBeenCalledWith('Network down', 'Unable to Save Spot');
    });
    expect(mocks.invalidateQueries).not.toHaveBeenCalled();
  });

  it('ignores another map selection while a spot save is pending', () => {
    mocks.isUpdatingDraft = true;
    render(<GlobeScene />);

    expect(screen.getByRole('status').textContent).toBe('Saving spot…');
    fireEvent.click(screen.getByRole('button', { name: 'Select Pipeline' }));

    expect(mocks.updateDraft).not.toHaveBeenCalled();
  });
});

describe('GlobeScene pin placement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isUpdatingDraft = false;
    mocks.matches = [{ routeId: '/_panel/upload', search: { draftId: 'draft-1' } }];
    mocks.pinPlacementState.isActive = true;
    mocks.pinPlacementState.tempPin = [151, -34];
  });

  it('passes pin-placement state to the map and owns temp pin updates from coordinate clicks', () => {
    render(<GlobeScene />);

    expect(screen.getByText('Add spot panel')).toBeInTheDocument();
    expect(screen.getByText('Select Pipeline').parentElement).toHaveAttribute('data-pin-active', 'true');
    expect(screen.getByText('Select Pipeline').parentElement).toHaveAttribute('data-temp-pin', '151,-34');

    fireEvent.click(screen.getByRole('button', { name: 'Place pin' }));

    expect(mocks.pinPlacementState.setTempPin).toHaveBeenCalledWith([151.2, -33.85]);
  });
});

describe('GlobeScene selected spot ownership', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isUpdatingDraft = false;
    mocks.matches = [];
    mocks.pinPlacementState.isActive = false;
    mocks.pinPlacementState.tempPin = null;
  });

  it('passes the selected route spot as state without owning camera intent lifecycle', () => {
    const { rerender } = render(<GlobeScene />);

    expect(screen.getByText('Select Pipeline').parentElement).toHaveAttribute('data-selected-spot-id', '');
    expect(screen.getByText('Select Pipeline').parentElement).toHaveAttribute('data-has-camera-intent', 'false');

    mocks.matches = [{ routeId: '/_panel/$spotId', params: { spotId: 'spot-1' } }];
    rerender(<GlobeScene />);

    expect(screen.getByText('Select Pipeline').parentElement).toHaveAttribute('data-selected-spot-id', 'spot-1');
    expect(screen.getByText('Select Pipeline').parentElement).toHaveAttribute('data-has-camera-intent', 'false');
  });
});
