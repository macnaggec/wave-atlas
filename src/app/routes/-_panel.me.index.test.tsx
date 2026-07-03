import { screen } from '@testing-library/react';
import type { ComponentType } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'test/setup/render';
import { Route } from './_panel.me.index';

const mocks = vi.hoisted(() => ({
  isLoading: false,
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
}));

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQuery: () => ({
      data: mocks.sessions,
      isLoading: mocks.isLoading,
    }),
  };
});

vi.mock('shared/lib/trpc', () => ({
  useTRPC: () => ({
    sessions: {
      mine: {
        queryOptions: () => ({}),
      },
    },
  }),
}));

describe('UploadsTab', () => {
  it('renders empty uploads inside the shared panel gallery inset', () => {
    mocks.isLoading = false;
    mocks.sessions = [];
    const Component = (Route as unknown as { component: ComponentType }).component;

    render(<Component />);

    expect(screen.getByText('No sessions yet. Upload your first session!').closest('[data-panel-gallery-inset]')).not.toBeNull();
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
    expect(screen.getByRole('grid', { name: 'My uploads' })).toBeInTheDocument();
  });
});
