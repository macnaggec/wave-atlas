import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useRetireSurfSession, useStartSessionEdit } from './usePublishedSession';

const mocks = vi.hoisted(() => ({
  invalidateQueries: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: mocks.invalidateQueries,
  }),
  useMutation: (options: {
    onSuccess?: (data: { id: string }, variables: string) => Promise<void> | void;
  }) => ({
    mutateAsync: async (sessionId: string) => {
      const result = { id: 'workspace-1' };
      await options.onSuccess?.(result, sessionId);
      return result;
    },
    isPending: false,
  }),
}));

function queryFilter(path: string) {
  return (input?: unknown) => ({ queryKey: [path, input] });
}

vi.mock('shared/lib/trpc', () => ({
  useTRPC: () => ({
    uploads: {
      startSessionEdit: { mutationOptions: (options?: object) => options ?? {} },
      getActiveWorkspace: { queryFilter: queryFilter('uploads.getActiveWorkspace') },
      getWorkspaceState: { queryFilter: queryFilter('uploads.getWorkspaceState') },
    },
    sessions: {
      retire: { mutationOptions: (options?: object) => options ?? {} },
      list: { pathFilter: () => ({ queryKey: ['sessions.list'] }) },
      mine: { queryFilter: queryFilter('sessions.mine') },
      byId: { queryFilter: queryFilter('sessions.byId') },
      media: { queryFilter: queryFilter('sessions.media') },
    },
    users: {
      myUploads: { queryFilter: queryFilter('users.myUploads') },
    },
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useStartSessionEdit', () => {
  it('refreshes workspace and session projections after opening an edit workspace', async () => {
    const { result } = renderHook(() => useStartSessionEdit());

    await act(async () => {
      await result.current.mutateAsync('session-1');
    });

    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['uploads.getActiveWorkspace', undefined],
    });
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['uploads.getWorkspaceState', { workspaceId: 'workspace-1' }],
    });
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['sessions.byId', 'session-1'],
    });
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['sessions.media', 'session-1'],
    });
  });
});

describe('useRetireSurfSession', () => {
  it('refreshes session projections after removal', async () => {
    const { result } = renderHook(() => useRetireSurfSession());

    await act(async () => {
      await result.current.mutateAsync('session-1');
    });

    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['sessions.mine', undefined],
    });
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['sessions.byId', 'session-1'],
    });
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['sessions.list'] });
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['sessions.media', 'session-1'],
    });
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['users.myUploads', undefined],
    });
  });
});
