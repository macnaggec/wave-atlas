import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useSpotMediaFeed } from './useSpotMediaFeed';

const mocks = vi.hoisted(() => ({
  infiniteQueryOptions: vi.fn(() => ({ queryKey: ['spots', 'mediaFeed'] })),
  useInfiniteQuery: vi.fn(() => ({ data: undefined })),
}));

vi.mock('@tanstack/react-query', () => ({ useInfiniteQuery: mocks.useInfiniteQuery }));
vi.mock('shared/lib/trpc', () => ({
  useTRPC: () => ({
    spots: { mediaFeed: { infiniteQueryOptions: mocks.infiniteQueryOptions } },
  }),
}));

describe('useSpotMediaFeed', () => {
  it('sends the shared browse filters to the gallery feed', () => {
    const date = new Date(2026, 6, 10, 12);

    renderHook(() => useSpotMediaFeed({
      spotId: 'spot-1',
      filters: { date: { date }, favoriteSpotsOnly: true },
    }));

    expect(mocks.infiniteQueryOptions).toHaveBeenCalledWith(
      {
        spotId: 'spot-1',
        limit: 30,
        sortOrder: 'desc',
        dateFrom: new Date(2026, 6, 10),
        dateTo: new Date(2026, 6, 11),
        favoriteSpotsOnly: true,
      },
      { getNextPageParam: expect.any(Function) },
    );
  });
});
