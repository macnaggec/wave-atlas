import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { render } from 'test/setup/render';
import { PanelGalleryLayout } from './PanelGalleryLayout';

describe('PanelGalleryLayout', () => {
  it('separates metadata, gallery content, and footer actions inside a panel body', () => {
    render(
      <PanelGalleryLayout
        meta={<span>Session metadata</span>}
        footer={<button type="button">Checkout</button>}
      >
        <div>Gallery cards</div>
      </PanelGalleryLayout>,
    );

    expect(screen.getByText('Session metadata').closest('[data-panel-gallery-meta]')).not.toBeNull();
    expect(screen.getByText('Gallery cards').closest('[data-panel-gallery-inset]')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Checkout' }).closest('[data-panel-gallery-footer]')).not.toBeNull();
  });

  it('anchors footer actions above the bottom of the panel outside the gallery scroll flow', () => {
    render(
      <PanelGalleryLayout footer={<button type="button">Checkout</button>}>
        <div>Gallery cards</div>
      </PanelGalleryLayout>,
    );

    const footer = screen.getByRole('button', { name: 'Checkout' }).closest('[data-panel-gallery-footer]');

    expect(footer?.getAttribute('data-panel-gallery-footer')).toBe('fixed');
    expect(footer?.closest('[data-panel-gallery-scroller]')).toBeNull();
  });
});
