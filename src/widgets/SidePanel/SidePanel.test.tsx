import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { render } from 'test/setup/render';
import { SidePanel } from './SidePanel';

describe('SidePanel', () => {
  it('renders a full-width route header without panel edge controls', () => {
    render(
      <SidePanel headerFullWidth header={<div>Cart header</div>}>
        <div>Panel body</div>
      </SidePanel>,
    );

    expect(screen.getByText('Cart header')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /expand panel/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /collapse panel/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /hide panel/i })).not.toBeInTheDocument();
  });
});
