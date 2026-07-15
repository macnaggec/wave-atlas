import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentType } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'test/setup/render';
import { Route } from './_panel.me.earnings';

const mocks = vi.hoisted(() => ({
  isLoading: false,
  isRequestingPayout: false,
  invalidateQueries: vi.fn(),
  notifyError: vi.fn(),
  notifySuccess: vi.fn(),
  requestPayout: vi.fn(),
  summary: {
    availableBalanceCents: 4500,
    pendingPayoutCents: 2200,
    payoutThresholdCents: 2000,
    recentTransactions: [],
    payoutRequests: [
      {
        id: 'payout-processing',
        amount: 1500,
        status: 'PROCESSING',
        externalTransferId: null,
        note: null,
        requestedAt: new Date('2026-07-05T12:00:00.000Z'),
        processedAt: null,
      },
      {
        id: 'payout-pending',
        amount: 700,
        status: 'PENDING',
        externalTransferId: null,
        note: null,
        requestedAt: new Date('2026-07-05T11:00:00.000Z'),
        processedAt: null,
      },
    ],
  },
}));

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: Record<string, unknown>) => options,
}));

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQuery: () => ({
      data: mocks.summary,
      isLoading: mocks.isLoading,
    }),
    useMutation: () => ({
      mutateAsync: mocks.requestPayout,
      isPending: mocks.isRequestingPayout,
    }),
    useQueryClient: () => ({
      invalidateQueries: mocks.invalidateQueries,
    }),
  };
});

vi.mock('shared/lib/trpc', () => ({
  useTRPC: () => ({
    ledger: {
      summary: {
        queryKey: () => ['ledger', 'summary'],
        queryOptions: () => ({ queryKey: ['ledger', 'summary'] }),
      },
      requestPayout: {
        mutationOptions: () => ({}),
      },
    },
  }),
}));

vi.mock('shared/lib/notifications', () => ({
  notify: {
    error: mocks.notifyError,
    success: mocks.notifySuccess,
  },
}));

describe('EarningsRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isLoading = false;
    mocks.isRequestingPayout = false;
    mocks.summary = {
      availableBalanceCents: 4500,
      pendingPayoutCents: 2200,
      payoutThresholdCents: 2000,
      recentTransactions: [],
      payoutRequests: [
        {
          id: 'payout-processing',
          amount: 1500,
          status: 'PROCESSING',
          externalTransferId: null,
          note: null,
          requestedAt: new Date('2026-07-05T12:00:00.000Z'),
          processedAt: null,
        },
        {
          id: 'payout-pending',
          amount: 700,
          status: 'PENDING',
          externalTransferId: null,
          note: null,
          requestedAt: new Date('2026-07-05T11:00:00.000Z'),
          processedAt: null,
        },
      ],
    };
  });

  it('shows the photographer ledger summary from the server', () => {
    const Component = (Route as unknown as { component: ComponentType }).component;

    render(<Component />);

    expect(screen.getByText('$45.00')).toBeInTheDocument();
    expect(screen.getByText('$22.00')).toBeInTheDocument();
    expect(screen.getByText('Payouts unlock at $20.00.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Request payout' })).toBeEnabled();
    expect(screen.getByText('Payout history')).toBeInTheDocument();
    expect(screen.getByText('Processing')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('disables payout requests below the server threshold', () => {
    mocks.summary = {
      ...mocks.summary,
      availableBalanceCents: 1999,
      pendingPayoutCents: 0,
      payoutRequests: [],
    };
    const Component = (Route as unknown as { component: ComponentType }).component;

    render(<Component />);

    expect(screen.getByText('$19.99')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Request payout' })).toBeDisabled();
    expect(screen.getByText('Payout requests will appear here.')).toBeInTheDocument();
  });

  it('requests payout and refreshes the visible ledger summary', async () => {
    mocks.requestPayout.mockResolvedValue(mocks.summary);
    const Component = (Route as unknown as { component: ComponentType }).component;

    render(<Component />);

    await userEvent.click(screen.getByRole('button', { name: 'Request payout' }));

    await waitFor(() => {
      expect(mocks.requestPayout).toHaveBeenCalledWith();
    });
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['ledger', 'summary'],
    });
    expect(mocks.notifySuccess).toHaveBeenCalledWith(
      'Your payout request was created.',
      'Payout Requested',
    );
  });

  it('shows an error notification when payout request fails', async () => {
    mocks.requestPayout.mockRejectedValue(new Error('Minimum payout is $20.00'));
    const Component = (Route as unknown as { component: ComponentType }).component;

    render(<Component />);

    await userEvent.click(screen.getByRole('button', { name: 'Request payout' }));

    await waitFor(() => {
      expect(mocks.notifyError).toHaveBeenCalledWith(
        'Minimum payout is $20.00',
        'Payout Request Failed',
      );
    });
  });
});
