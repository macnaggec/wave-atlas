import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ComponentType, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Route } from './_panel';

const mocks = vi.hoisted(() => ({
  createDraft: vi.fn(),
  navigate: vi.fn(),
  notifyError: vi.fn(),
  openAuth: vi.fn(),
  isAuthenticated: false,
  isCreatingDraft: false,
  latestDraft: null as { id: string } | null,
}));

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: Record<string, unknown>) => options,
  Outlet: () => null,
  useMatches: () => [{ routeId: '/_panel/', staticData: {} }],
  useNavigate: () => mocks.navigate,
  useParams: () => ({}),
  useRouter: () => ({ history: { back: vi.fn() } }),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: { hasDrafts: false } }),
}));

vi.mock('entities/Spot', () => ({
  useSelectedSpot: () => ({ spot: null }),
  useSpotPreview: () => ({ data: null }),
}));

vi.mock('entities/SurfSession', () => ({
  useCreateSurfSessionDraft: () => ({
    mutateAsync: mocks.createDraft,
    isPending: mocks.isCreatingDraft,
  }),
  useLatestSurfSessionDraft: () => ({ data: mocks.latestDraft }),
}));

vi.mock('shared/hooks/useUser', () => ({
  useUser: () => ({ isAuthenticated: mocks.isAuthenticated, isLoading: false, user: null }),
}));

vi.mock('features/Auth', () => ({
  useAuthModal: () => ({ open: mocks.openAuth }),
}));

vi.mock('shared/lib/trpc', () => ({
  useTRPC: () => ({
    users: { myDraftCounts: { queryOptions: vi.fn() } },
    sessions: { draft: { queryOptions: vi.fn() } },
  }),
}));

vi.mock('shared/lib/notifications', () => ({
  notify: { error: mocks.notifyError },
}));

vi.mock('entities/Commerce', () => ({
  useCartStore: () => [],
}));

vi.mock('widgets/SidePanel', () => ({
  SidePanel: ({ subheader, children }: { subheader?: ReactNode; children?: ReactNode }) => (
    <div>{subheader}{children}</div>
  ),
  ScopeSwitcher: () => null,
  FilterPills: () => null,
}));

vi.mock('widgets/FeedDrawer', () => ({ FeedSearch: () => null }));
vi.mock('features/Cart', () => ({ CartDrawerHeader: () => null }));

describe('Panel upload entry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isAuthenticated = false;
    mocks.isCreatingDraft = false;
    mocks.latestDraft = null;
  });

  it('opens authentication instead of creating a protected draft for an anonymous visitor', () => {
    const Component = (Route as unknown as { component: ComponentType }).component;
    render(<Component />);

    fireEvent.click(screen.getByRole('button', { name: 'Upload' }));

    expect(mocks.openAuth).toHaveBeenCalledOnce();
    expect(mocks.createDraft).not.toHaveBeenCalled();
  });

  it('navigates with the authoritative server draft when the cached draft is stale', async () => {
    mocks.isAuthenticated = true;
    mocks.latestDraft = { id: 'stale-draft' };
    mocks.createDraft.mockResolvedValue({ id: 'active-draft' });
    const Component = (Route as unknown as { component: ComponentType }).component;
    render(<Component />);

    fireEvent.click(screen.getByRole('button', { name: 'Upload' }));

    await waitFor(() => {
      expect(mocks.createDraft).toHaveBeenCalledOnce();
      expect(mocks.navigate).toHaveBeenCalledWith({
        to: '/upload',
        search: { draftId: 'active-draft' },
      });
    });
  });

  it('shows the photographer when opening the upload draft fails', async () => {
    mocks.isAuthenticated = true;
    mocks.createDraft.mockRejectedValue(new Error('Network down'));
    const Component = (Route as unknown as { component: ComponentType }).component;
    render(<Component />);

    fireEvent.click(screen.getByRole('button', { name: 'Upload' }));

    await waitFor(() => {
      expect(mocks.notifyError).toHaveBeenCalledWith('Network down', 'Unable to Start Upload');
    });
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it('blocks another Upload click while the draft is opening', () => {
    mocks.isAuthenticated = true;
    mocks.isCreatingDraft = true;
    const Component = (Route as unknown as { component: ComponentType }).component;
    render(<Component />);

    expect((screen.getByRole('button', { name: 'Upload' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
