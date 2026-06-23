import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ComponentType } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Route } from './_panel.upload';

const mocks = vi.hoisted(() => ({
  draft: {
    id: 'draft-1',
    spotId: 'spot-a',
    spot: { id: 'spot-a', name: 'Spot A', location: 'Beach' },
  },
  invalidateQueries: vi.fn(),
  createDraft: vi.fn(),
  navigate: vi.fn(),
  openAuthModal: vi.fn(),
  search: { draftId: 'draft-1' as string | undefined },
  query: {
    data: undefined as { id: string; spotId: string; spot: { id: string; name: string; location: string } } | undefined,
    isError: false,
    isLoading: false,
  },
  user: { isAuthenticated: true, isLoading: false },
  updateDraft: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: Record<string, unknown>) => ({
    ...options,
    useSearch: () => mocks.search,
  }),
  useNavigate: () => mocks.navigate,
}));

vi.mock('@tanstack/react-query', () => ({
  useMutation: () => ({ mutateAsync: mocks.updateDraft }),
  useQuery: () => mocks.query,
  useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
}));

vi.mock('shared/hooks/useUser', () => ({
  useUser: () => mocks.user,
}));

vi.mock('entities/Identity', () => ({
  useAuthModal: () => ({ open: mocks.openAuthModal }),
}));

vi.mock('entities/SurfSession', () => ({
  useCreateSurfSessionDraft: () => ({
    mutateAsync: mocks.createDraft,
    isPending: false,
  }),
}));

vi.mock('shared/lib/trpcClient', () => ({
  trpcProxy: { sessions: { draft: { queryOptions: vi.fn() } } },
}));

vi.mock('shared/lib/trpc', () => ({
  useTRPC: () => ({
    sessions: {
      draft: { queryOptions: vi.fn(), queryKey: () => ['sessions', 'draft'] },
      updateDraft: { mutationOptions: vi.fn() },
    },
  }),
}));

vi.mock('widgets/FeedDrawer', () => ({
  FeedSearch: ({
    activeSpot,
    onSpotSelect,
  }: {
    activeSpot: { id: string } | null;
    onSpotSelect: (spot: { id: string; name: string }) => void;
  }) => (
    <div>
      <span data-testid="selected-spot">{activeSpot?.id ?? 'none'}</span>
      <button onClick={() => onSpotSelect({ id: 'spot-b', name: 'Spot B' })}>Select Spot B</button>
    </div>
  ),
}));

vi.mock('features/Upload', () => ({
  UploadSidebar: ({ draft }: { draft: { spotId: string | null } }) => (
    <span data-testid="publish-spot">{draft.spotId ?? 'none'}</span>
  ),
}));

describe('UploadPanel draft ownership', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.search.draftId = 'draft-1';
    mocks.query.data = mocks.draft;
    mocks.query.isError = false;
    mocks.query.isLoading = false;
    mocks.user.isAuthenticated = true;
    mocks.user.isLoading = false;
    mocks.createDraft.mockResolvedValue(mocks.draft);
  });

  it('renders the server draft and persists spot selection to that draft', async () => {
    const Component = (Route as unknown as { component: ComponentType }).component;
    render(<Component />);

    expect(screen.getByTestId('selected-spot').textContent).toBe('spot-a');
    expect(screen.getByTestId('publish-spot').textContent).toBe('spot-a');

    fireEvent.click(screen.getByRole('button', { name: 'Select Spot B' }));

    await waitFor(() => {
      expect(mocks.updateDraft).toHaveBeenCalledWith({ draftId: 'draft-1', spotId: 'spot-b' });
    });
  });

  it('offers an explicit start action when the URL has no draft locator', async () => {
    mocks.search.draftId = undefined;
    mocks.query.data = undefined;
    const Component = (Route as unknown as { component: ComponentType }).component;
    render(<Component />);

    expect(screen.getByText('No upload draft is open')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Start or resume upload' }));

    await waitFor(() => expect(mocks.createDraft).toHaveBeenCalledWith({}));
    expect(mocks.navigate).toHaveBeenCalledWith({
      to: '/upload',
      search: { draftId: 'draft-1' },
      replace: true,
    });
  });

  it('offers the same recovery action when the URL points to an unavailable draft', () => {
    mocks.query.data = undefined;
    mocks.query.isError = true;
    const Component = (Route as unknown as { component: ComponentType }).component;
    render(<Component />);

    expect(screen.getByText('This upload draft is unavailable')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Start or resume upload' })).not.toBeNull();
  });

  it('offers sign-in before attempting to load a protected draft', () => {
    mocks.user.isAuthenticated = false;
    mocks.query.data = undefined;
    const Component = (Route as unknown as { component: ComponentType }).component;
    render(<Component />);

    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(mocks.openAuthModal).toHaveBeenCalledOnce();
  });
});
