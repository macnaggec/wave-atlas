import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toSessionFeedDateRange, useSessionFeed } from './useSessionFeed';

const mocks = vi.hoisted(() => ({
  infiniteQueryOptions: vi.fn(() => ({ queryKey: ['sessions', 'list'] })),
  useInfiniteQuery: vi.fn(() => ({})),
}));

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useInfiniteQuery: mocks.useInfiniteQuery,
  };
});

vi.mock('shared/lib/trpc', () => ({
  useTRPC: () => ({
    sessions: {
      list: {
        infiniteQueryOptions: mocks.infiniteQueryOptions,
      },
    },
  }),
}));

describe('useSessionFeed', () => {
  beforeEach(() => {
    mocks.infiniteQueryOptions.mockClear();
    mocks.useInfiniteQuery.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('includes today and the previous six calendar days for the last seven days filter', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 20, 15, 30));

    expect(toSessionFeedDateRange('last7')).toEqual({
      dateFrom: new Date(2026, 5, 14),
      dateTo: new Date(2026, 5, 21),
    });
  });

  it('owns the spot and custom-date query contract', () => {
    const selectedDate = new Date(2026, 4, 3, 12, 15);

    renderHook(() => useSessionFeed({
      spotId: 'adca9ad6-f886-4f19-bb64-64c092873c59',
      filter: { date: selectedDate },
    }));

    expect(mocks.infiniteQueryOptions).toHaveBeenCalledWith(
      {
        limit: 20,
        spotId: 'adca9ad6-f886-4f19-bb64-64c092873c59',
        dateFrom: new Date(2026, 4, 3),
        dateTo: new Date(2026, 4, 4),
      },
      { getNextPageParam: expect.any(Function) },
    );

    const pagination = mocks.infiniteQueryOptions.mock.calls[0]?.[1];
    expect(pagination?.getNextPageParam({ nextCursor: 'next-session' })).toBe('next-session');
    expect(pagination?.getNextPageParam({ nextCursor: null })).toBeUndefined();
  });
});
