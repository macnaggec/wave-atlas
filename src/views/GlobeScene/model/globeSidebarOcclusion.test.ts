import { describe, expect, it } from 'vitest';
import { deriveGlobeSidebarOcclusionPx } from './globeSidebarOcclusion';

describe('deriveGlobeSidebarOcclusionPx', () => {
  it('reserves the compact panel width while the panel is not expanded', () => {
    expect(deriveGlobeSidebarOcclusionPx({
      isRenderedPanelExpanded: false,
      viewportWidthPx: 2000,
    })).toBe(500); // 25% of 2000
  });

  it('reserves the expanded panel width while the panel is expanded', () => {
    expect(deriveGlobeSidebarOcclusionPx({
      isRenderedPanelExpanded: true,
      viewportWidthPx: 2000,
    })).toBe(1500); // 75% of 2000
  });
});
