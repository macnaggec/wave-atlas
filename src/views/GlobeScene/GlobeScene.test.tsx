import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GlobeScene } from './GlobeScene';

const mocks = vi.hoisted(() => ({
  invalidateQueries: vi.fn(),
  isUpdatingDraft: false,
  navigate: vi.fn(),
  notifyError: vi.fn(),
  updateDraft: vi.fn(),
}));

vi.mock('widgets/GlobeMap', () => ({
  GlobeMap: ({ onSpotSelect }: { onSpotSelect: (spot: { id: string }) => void }) => (
    <button onClick={() => onSpotSelect({ id: 'spot-1' })}>Select Pipeline</button>
  ),
}));

vi.mock('entities/Spot', () => ({
  useMapSpots: () => ({ data: [] }),
}));

vi.mock('features/AddSpot', () => ({
  AddSpotPanel: () => null,
  usePinPlacementStore: () => false,
}));

vi.mock('@tanstack/react-query', () => ({
  useMutation: () => ({
    mutateAsync: mocks.updateDraft,
    isPending: mocks.isUpdatingDraft,
  }),
  useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
}));

vi.mock('@tanstack/react-router', () => ({
  useMatches: () => [{ routeId: '/_panel/upload', search: { draftId: 'draft-1' } }],
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
