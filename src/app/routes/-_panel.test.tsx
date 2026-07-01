import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import type { ComponentType, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'test/setup/render';
import { Route, usePanelFeedLayoutReadyChange } from './_panel';

const mocks = vi.hoisted(() => ({
  createDraft: vi.fn(),
  navigate: vi.fn(),
  notifyError: vi.fn(),
  openAuth: vi.fn(),
  isAuthenticated: false,
  isCreatingDraft: false,
  latestDraft: null as { id: string } | null,
  matches: [{ routeId: '/_panel/', staticData: {} }] as Array<{
    routeId: string;
    staticData: { forceExpanded?: boolean };
    loaderData?: unknown;
    search?: unknown;
  }>,
}));

function FeedLayoutReadyProbe() {
  const reportLayoutReadyChange = usePanelFeedLayoutReadyChange();
  return <button onClick={() => reportLayoutReadyChange(true)}>Report feed layout ready</button>;
}

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: Record<string, unknown>) => options,
  Outlet: () => <FeedLayoutReadyProbe />,
  useMatches: () => mocks.matches,
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
  SidePanel: ({
    expanded,
    onExpandToggle,
    header,
    headerFullWidth,
    subheader,
    children,
  }: {
    expanded?: boolean;
    onExpandToggle?: () => void;
    header?: ReactNode;
    headerFullWidth?: boolean;
    subheader?: ReactNode;
    children?: ReactNode;
  }) => (
    <div
      data-testid="side-panel"
      data-expanded={expanded ? 'true' : 'false'}
      data-header-full-width={headerFullWidth ? 'true' : 'false'}
    >
      {onExpandToggle && <button aria-label={expanded ? 'Collapse panel' : 'Expand panel'} />}
      {header}
      {subheader}
      {children}
    </div>
  ),
  ScopeSwitcher: () => null,
  FilterPills: () => null,
}));

vi.mock('widgets/FeedDrawer', () => ({ FeedSearch: () => null }));
vi.mock('features/Cart', () => ({
  CartDrawerHeader: ({
    spotName,
    onBack,
  }: {
    spotName?: string;
    onBack?: () => void;
  }) => (onBack ? <button onClick={onBack}>{spotName ?? 'Back to feed'}</button> : null),
}));

describe('Panel upload entry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isAuthenticated = false;
    mocks.isCreatingDraft = false;
    mocks.latestDraft = null;
    mocks.matches = [{ routeId: '/_panel/', staticData: {} }];
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

  it('does not show the panel minimize control on the cart route', () => {
    mocks.matches = [{ routeId: '/_panel/cart', staticData: {}, search: {} }];
    const Component = (Route as unknown as { component: ComponentType }).component;
    render(<Component />);

    expect(screen.queryByRole('button', { name: 'Expand panel' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Collapse panel' })).not.toBeInTheDocument();
  });

  it('opens the cart route in the full-size panel', () => {
    mocks.matches = [{ routeId: '/_panel/cart', staticData: {}, search: {} }];
    const Component = (Route as unknown as { component: ComponentType }).component;
    render(<Component />);

    expect(screen.getByTestId('side-panel').getAttribute('data-expanded')).toBe('true');
  });

  it('lets the cart header span the full panel width', () => {
    mocks.matches = [{ routeId: '/_panel/cart', staticData: {}, search: {} }];
    const Component = (Route as unknown as { component: ComponentType }).component;
    render(<Component />);

    expect(screen.getByTestId('side-panel').getAttribute('data-header-full-width')).toBe('true');
  });

  it('routes cart visitors without a spot origin back to the feed', () => {
    mocks.matches = [{ routeId: '/_panel/cart', staticData: {}, search: {} }];
    const Component = (Route as unknown as { component: ComponentType }).component;
    render(<Component />);

    fireEvent.click(screen.getByRole('button', { name: 'Back to feed' }));

    expect(mocks.navigate).toHaveBeenCalledWith({ to: '/' });
  });

  it('commits the returning feed before collapsing the panel layout', () => {
    let runNextFrame: FrameRequestCallback | undefined;
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
      runNextFrame = callback;
      return 1;
    }));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    mocks.matches = [{
      routeId: '/_panel/$spotId/session/$sessionId',
      staticData: { forceExpanded: true },
      loaderData: null,
    }];
    const Component = (Route as unknown as { component: ComponentType }).component;
    const { rerender } = render(<Component />);

    mocks.matches = [{ routeId: '/_panel/', staticData: {} }];
    rerender(<Component />);

    expect(screen.getByTestId('side-panel').getAttribute('data-expanded')).toBe('true');
    expect(runNextFrame).toBeUndefined();

    fireEvent.click(screen.getByRole('button', { name: 'Report feed layout ready' }));

    expect(screen.getByTestId('side-panel').getAttribute('data-expanded')).toBe('true');

    act(() => runNextFrame?.(0));

    expect(screen.getByTestId('side-panel').getAttribute('data-expanded')).toBe('false');
    vi.unstubAllGlobals();
  });
});
