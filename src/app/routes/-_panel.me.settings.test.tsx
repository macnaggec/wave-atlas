import { screen } from '@testing-library/react';
import type { ComponentType } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'test/setup/render';
import { Route } from './_panel.me.index';

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: Record<string, unknown>) => options,
}));

describe('AccountRoute', () => {
  it('shows the account page in the panel workspace', () => {
    const Component = (Route as unknown as { component: ComponentType }).component;

    render(<Component />);

    expect(screen.getByText('Profile and security controls will appear here.')).toBeInTheDocument();
  });
});
