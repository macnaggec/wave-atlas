import { describe, expect, it } from 'vitest';
import { getAnchoredVisibleRowIndex } from './VirtualGallery';

describe('getAnchoredVisibleRowIndex', () => {
  it('uses the row around the viewport anchor instead of the first partially visible row', () => {
    const rows = [
      { index: 10, start: 1515, size: 220 },
      { index: 11, start: 1735, size: 48 },
      { index: 12, start: 1783, size: 220 },
    ];

    expect(getAnchoredVisibleRowIndex(rows, 1634, 611)).toBe(11);
  });
});
