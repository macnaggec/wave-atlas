import { readFileSync } from 'node:fs';
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { render } from 'test/setup/render';
import { SidePanel } from './SidePanel';
import { PanelScrollChrome, PanelScrollChromeProvider } from 'shared/ui/PanelScrollChrome';

const sidePanelCss = readFileSync('src/shared/ui/PanelScrollChrome.module.css', 'utf8');

function cssRule(selector: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = sidePanelCss.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`));

  return match?.[1]?.replace(/\s+/g, ' ').trim() ?? '';
}

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

  it('hides the full-width subheader when descendant panel content scrolls down and reveals it on scroll up', () => {
    render(
      <SidePanel
        hideSubheaderOnScroll
        subheader={<div>Search and filters</div>}
      >
        <PanelScrollChrome />
        <div
          data-testid="media-list"
          style={{ height: 120, overflowY: 'auto' }}
        >
          <div style={{ height: 480 }}>Media cards</div>
        </div>
      </SidePanel>,
    );

    const subheader = screen.getByText('Search and filters').closest('[data-panel-scroll-chrome]');
    const mediaList = screen.getByTestId('media-list');

    fireEvent.scroll(mediaList, { target: { scrollTop: 80 } });
    expect(subheader).toHaveAttribute('data-hidden');

    fireEvent.scroll(mediaList, { target: { scrollTop: 20 } });
    expect(subheader).not.toHaveAttribute('data-hidden');
  });

  it('does not reveal the subheader for a tiny opposite scroll correction during momentum', () => {
    render(
      <SidePanel
        hideSubheaderOnScroll
        subheader={<div>Search and filters</div>}
      >
        <PanelScrollChrome />
        <div
          data-testid="media-list"
          style={{ height: 120, overflowY: 'auto' }}
        >
          <div style={{ height: 480 }}>Media cards</div>
        </div>
      </SidePanel>,
    );

    const subheader = screen.getByText('Search and filters').closest('[data-panel-scroll-chrome]');
    const mediaList = screen.getByTestId('media-list');

    fireEvent.scroll(mediaList, { target: { scrollTop: 80 } });
    fireEvent.scroll(mediaList, { target: { scrollTop: 79 } });

    expect(subheader).toHaveAttribute('data-hidden');
  });

  it('keeps sticky search chrome transparent above scrolled content', () => {
    expect(cssRule('.chrome')).not.toMatch(/(?:^|; )background:/);
    expect(cssRule('.chrome[data-over-content]')).toBe('');
    expect(cssRule('.chrome')).toContain('--wa-panel-control-background: rgba(255, 255, 255, 0.24)');
    expect(cssRule('.chrome')).toContain('--wa-panel-control-backdrop: blur(24px) saturate(140%)');
  });

  it('gives Mantine controls projected into any gallery chrome the shared control glass', () => {
    const rule = cssRule('.chrome :global(.mantine-Tabs-list)');
    expect(sidePanelCss).toContain('.chrome :global(.mantine-Input-input),');
    expect(rule).toContain('background: var(--wa-panel-control-background)');
    expect(rule).toContain('backdrop-filter: var(--wa-panel-control-backdrop)');
    expect(rule).toContain('border: 1px solid var(--wa-glass-border-media-overlay)');
  });

  it('shares the same hidden state with descendant gallery chrome', () => {
    render(
      <SidePanel>
        <PanelScrollChromeProvider value={<div>Collection filters</div>}>
          <PanelScrollChrome />
        </PanelScrollChromeProvider>
        <div
          data-testid="collection-list"
          style={{ height: 120, overflowY: 'auto' }}
        >
          <div style={{ height: 480 }}>Collection cards</div>
        </div>
      </SidePanel>,
    );

    const toolbar = screen.getByText('Collection filters').closest('[data-panel-scroll-chrome]');
    const collectionList = screen.getByTestId('collection-list');

    fireEvent.scroll(collectionList, { target: { scrollTop: 80 } });
    expect(toolbar).toHaveAttribute('data-hidden');

    fireEvent.scroll(collectionList, { target: { scrollTop: 20 } });
    expect(toolbar).not.toHaveAttribute('data-hidden');
  });
});
