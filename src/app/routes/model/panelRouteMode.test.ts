import { describe, expect, it } from 'vitest';
import { getPanelRouteMode } from './panelRouteMode';

describe('getPanelRouteMode', () => {
  it('leaves feed and spot browsing under user control', () => {
    expect(getPanelRouteMode([{ routeId: '/_panel/' }])).toBe('browsing');
    expect(getPanelRouteMode([{ routeId: '/_panel/$spotId' }])).toBe('browsing');
    expect(getPanelRouteMode([{ routeId: '/_panel/$spotId', staticData: { panelMode: 'browsing' } }])).toBe('browsing');
  });

  it('classifies focused workspaces from route static data', () => {
    expect(getPanelRouteMode([{ routeId: '/anything/gallery', staticData: { panelMode: 'workspace' } }])).toBe('workspace');
    expect(getPanelRouteMode([{ routeId: '/anything/session', staticData: { panelMode: 'workspace' } }])).toBe('workspace');
    expect(getPanelRouteMode([{ routeId: '/anything/me', staticData: { panelMode: 'workspace' } }])).toBe('workspace');
  });

  it('classifies cart through the same workspace route metadata', () => {
    expect(getPanelRouteMode([{ routeId: '/anything/cart', staticData: { panelMode: 'workspace' } }])).toBe('workspace');
  });

  it('classifies upload from route static data as compact map input', () => {
    expect(getPanelRouteMode([{ routeId: '/anything/upload', staticData: { panelMode: 'mapInput' } }])).toBe('mapInput');
  });

  it('lets the deepest active route mode own the panel behavior', () => {
    expect(getPanelRouteMode([
      { routeId: '/_panel/me', staticData: { panelMode: 'workspace' } },
      { routeId: '/_panel/upload', staticData: { panelMode: 'mapInput' } },
    ])).toBe('mapInput');
  });
});
