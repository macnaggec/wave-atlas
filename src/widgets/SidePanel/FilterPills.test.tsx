import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'test/setup/render';
import { FilterPills } from './FilterPills';

describe('FilterPills favorites filter', () => {
  it('toggles favorites independently of the active date filter', () => {
    const onChange = vi.fn();
    const onFavoritesChange = vi.fn();

    render(
      <FilterPills
        active="today"
        onChange={onChange}
        favoritesOnly={false}
        onFavoritesChange={onFavoritesChange}
      />,
    );

    const favorites = screen.getByRole('button', { name: 'Favorites' });
    expect(favorites).toHaveAttribute('aria-pressed', 'false');
    expect(favorites.style.background).toBe('var(--wa-panel-control-background, var(--wa-control-fill))');
    expect(favorites.style.backdropFilter).toBe('var(--wa-panel-control-backdrop, blur(10px))');
    expect(screen.getByRole('button', { name: 'Today' })).toBeInTheDocument();

    fireEvent.click(favorites);

    expect(onFavoritesChange).toHaveBeenCalledWith(true);
    expect(onChange).not.toHaveBeenCalled();
  });
});
