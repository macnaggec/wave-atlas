import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'test/setup/render';
import { LeftStrip } from './LeftStrip';

const mocks = vi.hoisted(() => ({
  isAuthenticated: true,
  count: 0,
}));

vi.mock('shared/hooks/useUser', () => ({
  useUser: () => ({ isAuthenticated: mocks.isAuthenticated }),
}));

vi.mock('entities/Commerce', () => ({
  useCartStore: (selector: (state: { items: unknown[] }) => unknown) =>
    selector({ items: Array.from({ length: mocks.count }) }),
}));

vi.mock('./CartControl', () => ({
  CartControl: () => <div data-testid="cart-control" />,
}));

vi.mock('./UserControl', () => ({
  UserControl: () => <div data-testid="user-control" />,
}));

describe('LeftStrip', () => {
  it('shows the cart control for an anonymous user when the cart has items', () => {
    mocks.isAuthenticated = false;
    mocks.count = 2;

    render(<LeftStrip />);

    expect(screen.getByTestId('cart-control')).toBeInTheDocument();
  });

  it('hides the cart control when the cart is empty, regardless of auth', () => {
    mocks.isAuthenticated = false;
    mocks.count = 0;

    render(<LeftStrip />);

    expect(screen.queryByTestId('cart-control')).not.toBeInTheDocument();
  });
});
