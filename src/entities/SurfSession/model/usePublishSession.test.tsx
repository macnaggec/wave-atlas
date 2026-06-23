import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePublishSession } from './usePublishSession';

const mocks = vi.hoisted(() => ({
  invalidateQueries: vi.fn().mockResolvedValue(undefined),
  removeQueries: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: mocks.invalidateQueries,
    removeQueries: mocks.removeQueries,
  }),
  useMutation: (options: {
    onSuccess?: (data: unknown, variables: string) => Promise<void> | void;
  }) => ({
    mutateAsync: async (draftId: string) => {
      await options.onSuccess?.({ mediaIds: ['media-1'] }, draftId);
      return { mediaIds: ['media-1'] };
    },
    isPending: false,
  }),
}));

function queryFilter(path: string) {
  return (input?: unknown, filters?: { exact?: boolean }) => ({
    queryKey: [path, input],
    ...filters,
  });
}

vi.mock('shared/lib/trpc', () => ({
  useTRPC: () => ({
    sessions: {
      publish: { mutationOptions: (options?: object) => options ?? {} },
      draft: { queryFilter: queryFilter('sessions.draft') },
      draftMedia: { queryFilter: queryFilter('sessions.draftMedia') },
      latestDraft: { queryFilter: queryFilter('sessions.latestDraft') },
      list: { pathFilter: () => ({ queryKey: ['sessions.list'] }) },
      mine: { queryFilter: queryFilter('sessions.mine') },
      byId: { queryFilter: queryFilter('sessions.byId') },
      media: { queryFilter: queryFilter('sessions.media') },
    },
    users: {
      myDraftCounts: { queryFilter: queryFilter('users.myDraftCounts') },
      myUploads: { queryFilter: queryFilter('users.myUploads') },
    },
    media: {
      myDrafts: { queryFilter: queryFilter('media.myDrafts') },
    },
  }),
}));

describe('usePublishSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('removes obsolete draft caches and refreshes every published-session projection', async () => {
    const { result } = renderHook(() => usePublishSession());

    await act(async () => {
      await result.current.mutateAsync('draft-1');
    });

    expect(mocks.removeQueries).toHaveBeenCalledWith({
      queryKey: ['sessions.draft', 'draft-1'],
      exact: true,
    });
    expect(mocks.removeQueries).toHaveBeenCalledWith({
      queryKey: ['sessions.draftMedia', 'draft-1'],
      exact: true,
    });
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['sessions.latestDraft', undefined],
    });
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['sessions.list'] });
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['sessions.mine', undefined],
    });
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['sessions.byId', 'draft-1'],
    });
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['sessions.media', 'draft-1'],
    });
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['users.myDraftCounts', undefined],
    });
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['users.myUploads', undefined],
    });
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['media.myDrafts', undefined],
    });
  });
});
