import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentType } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'test/setup/render';
import { Route } from './_panel.me.collections.index';

const mocks = vi.hoisted(() => ({
  isLoading: false,
  navigate: vi.fn(),
  startSessionEdit: vi.fn(),
  sessions: [] as Array<{
    id: string;
    status: 'DRAFT' | 'PUBLISHED';
    thumbnailUrl: string | null;
    startsAt: Date;
    endsAt: Date;
    mediaCount: number;
    spot: { id: string; name: string };
  }>,
}));

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: Record<string, unknown>) => options,
  useNavigate: () => mocks.navigate,
}));

vi.mock('./_panel.me.collections', () => ({
  useCollectionsContext: () => ({
    sessions: mocks.sessions,
    visibleUploads: mocks.sessions,
    isLoadingUploads: mocks.isLoading,
  }),
}));

vi.mock('entities/SurfSession', () => ({
  SurfSessionCard: ({ session }: { session: { spot: { name: string } } }) => (
    <div>{session.spot.name}</div>
  ),
  RemoveSessionModal: () => null,
  useStartSessionEdit: () => ({ mutateAsync: mocks.startSessionEdit, isPending: false }),
}));

describe('UploadsTab', () => {
  it('renders empty uploads inside the shared panel gallery inset with an Upload action', async () => {
    mocks.isLoading = false;
    mocks.sessions = [];
    const Component = (Route as unknown as { component: ComponentType }).component;

    render(<Component />);

    expect(screen.getByText('No sessions yet').closest('[data-panel-gallery-inset]')).not.toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Upload' }));

    expect(mocks.navigate).toHaveBeenCalledWith({ to: '/upload' });
  });

  it('renders upload session cards inside the shared panel gallery inset', () => {
    mocks.isLoading = false;
    mocks.sessions = [{
      id: 'session-1',
      status: 'PUBLISHED',
      thumbnailUrl: null,
      startsAt: new Date('2026-06-01T06:00:00.000Z'),
      endsAt: new Date('2026-06-01T08:00:00.000Z'),
      mediaCount: 2,
      spot: { id: 'spot-1', name: 'Pipeline' },
    }];
    const Component = (Route as unknown as { component: ComponentType }).component;

    render(<Component />);

    expect(screen.getByText('Pipeline').closest('[data-panel-gallery-inset]')).not.toBeNull();
    expect(screen.getByRole('grid', { name: 'Uploads' })).toBeInTheDocument();
  });
});
