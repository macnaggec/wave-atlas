import { describe, it, expect } from 'vitest';
import { buildGalleryRows } from './buildGalleryRows';
import type { GalleryRow } from './buildGalleryRows';
import type { MediaItem } from 'entities/Media/types';

function makeItem(id: string, capturedAt: Date): MediaItem {
  return {
    id,
    photographerId: 'user-1',
    spotId: 'spot-1',
    capturedAt,
    price: 10,
    lightboxUrl: 'https://example.com/lbw.jpg',
    thumbnailUrl: 'https://example.com/thumb.jpg',
    cloudinaryPublicId: 'test/img',
    status: 'PUBLISHED' as const,
    createdAt: new Date('2024-01-01'),
    resource: { resource_type: 'image', url: 'https://example.com/lbw.jpg', asset_id: id },
  } as MediaItem;
}

// Use UTC constructors so .getUTCHours() returns the expected value
// regardless of the timezone the test runner is in.
const JAN_1_10AM = new Date(Date.UTC(2024, 0, 1, 10, 0, 0));
const JAN_1_14PM = new Date(Date.UTC(2024, 0, 1, 14, 0, 0));
const JAN_1_18PM = new Date(Date.UTC(2024, 0, 1, 18, 0, 0));
const JAN_2 = new Date(Date.UTC(2024, 0, 2, 10, 0, 0));
const JAN_3 = new Date(Date.UTC(2024, 0, 3, 10, 0, 0));

const JAN_1 = JAN_1_10AM;

describe('buildGalleryRows — base behaviour', () => {
  it('returns empty array for empty input', () => {
    expect(buildGalleryRows([])).toEqual([]);
  });

  it('returns one divider + one full media row for 3 items on the same date', () => {
    const items = [makeItem('a', JAN_1), makeItem('b', JAN_1), makeItem('c', JAN_1)];
    const rows = buildGalleryRows(items);

    expect(rows).toHaveLength(2);
    expect(rows[0]!.type).toBe('divider');
    expect(rows[1]!.type).toBe('media');
    expect((rows[1]! as Extract<GalleryRow, { type: 'media' }>).items).toHaveLength(3);
  });

  it('divider carries mediaRowCount equal to ceil(items / columns)', () => {
    const items = Array.from({ length: 7 }, (_, i) => makeItem(`m${i}`, JAN_1));
    const rows = buildGalleryRows(items);

    expect(rows[0]!.type).toBe('divider');
    expect((rows[0]! as Extract<GalleryRow, { type: 'divider' }>).mediaRowCount).toBe(3); // ceil(7/3)
  });

  it('produces partial last row when items do not fill a full row', () => {
    const items = [makeItem('a', JAN_1), makeItem('b', JAN_1), makeItem('c', JAN_1), makeItem('d', JAN_1)];
    const rows = buildGalleryRows(items);

    expect(rows).toHaveLength(3); // divider + row(3) + row(1)
    expect((rows[2]! as Extract<GalleryRow, { type: 'media' }>).items).toHaveLength(1);
  });

  it('inserts a divider before each new date group', () => {
    const items = [makeItem('a', JAN_1), makeItem('b', JAN_1), makeItem('c', JAN_2)];
    const rows = buildGalleryRows(items);

    expect(rows).toHaveLength(4);
    expect(rows[0]!.type).toBe('divider');
    expect(rows[2]!.type).toBe('divider');
    expect((rows[0]! as Extract<GalleryRow, { type: 'divider' }>).date).toEqual(JAN_1);
    expect((rows[2]! as Extract<GalleryRow, { type: 'divider' }>).date).toEqual(JAN_2);
  });

  it('handles 3 distinct dates correctly', () => {
    const items = [makeItem('a', JAN_1), makeItem('b', JAN_2), makeItem('c', JAN_3)];
    const rows = buildGalleryRows(items);

    expect(rows).toHaveLength(6);
    expect(rows.map((r) => r.type)).toEqual(['divider', 'media', 'divider', 'media', 'divider', 'media']);
  });

  it('chunks 7 same-date items into rows of 3, 3, 1', () => {
    const items = Array.from({ length: 7 }, (_, i) => makeItem(`m${i}`, JAN_1));
    const rows = buildGalleryRows(items);

    expect(rows).toHaveLength(4);
    const mediaSizes = rows
      .filter((r) => r.type === 'media')
      .map((r) => (r.type === 'media' ? r.items.length : 0));
    expect(mediaSizes).toEqual([3, 3, 1]);
  });

  it('respects custom columns count', () => {
    const items = Array.from({ length: 4 }, (_, i) => makeItem(`m${i}`, JAN_1));
    const rows = buildGalleryRows(items, 2);

    const mediaSizes = rows
      .filter((r) => r.type === 'media')
      .map((r) => (r.type === 'media' ? r.items.length : 0));
    expect(mediaSizes).toEqual([2, 2]);
  });

  it('assigns unique keys to each row', () => {
    const items = [makeItem('a', JAN_1), makeItem('b', JAN_1), makeItem('c', JAN_2)];
    const rows = buildGalleryRows(items);
    const keys = rows.map((r) => r.key);

    expect(new Set(keys).size).toBe(rows.length);
  });
});

describe('buildGalleryRows — hour drill-down (expandedDate)', () => {
  it('does not insert hour-dividers when expandedDate is null', () => {
    const items = [makeItem('a', JAN_1_10AM), makeItem('b', JAN_1_14PM)];
    const rows = buildGalleryRows(items, 3, null);
    expect(rows.every((r) => r.type !== 'hour-divider')).toBe(true);
  });

  it('inserts hour-dividers within the expanded date', () => {
    // Items arrive DESC from API: 6pm first, then 2pm, then 10am
    const items = [
      makeItem('c', JAN_1_18PM),
      makeItem('b', JAN_1_14PM),
      makeItem('a', JAN_1_10AM),
    ];
    const rows = buildGalleryRows(items, 3, JAN_1_10AM);
    const types = rows.map((r) => r.type);

    // date-divider, then chronological: hour(10), media, hour(14), media, hour(18), media
    expect(types).toEqual(['divider', 'hour-divider', 'media', 'hour-divider', 'media', 'hour-divider', 'media']);
  });

  it('hour-dividers carry the correct hour value', () => {
    const items = [makeItem('b', JAN_1_14PM), makeItem('a', JAN_1_10AM)];
    const rows = buildGalleryRows(items, 3, JAN_1_10AM);
    const hourDividers = rows.filter((r) => r.type === 'hour-divider');

    expect(hourDividers).toHaveLength(2);
    expect((hourDividers[0]! as Extract<GalleryRow, { type: 'hour-divider' }>).hour).toBe(10);
    expect((hourDividers[1]! as Extract<GalleryRow, { type: 'hour-divider' }>).hour).toBe(14);
  });

  it('orders items within the expanded day chronologically (earliest first)', () => {
    const items = [makeItem('b', JAN_1_14PM), makeItem('a', JAN_1_10AM)];
    const rows = buildGalleryRows(items, 3, JAN_1_10AM);
    const mediaRows = rows.filter((r) => r.type === 'media');

    // First media row should have the 10am item, second the 2pm item
    expect((mediaRows[0]! as Extract<GalleryRow, { type: 'media' }>).items[0]!.id).toBe('a');
    expect((mediaRows[1]! as Extract<GalleryRow, { type: 'media' }>).items[0]!.id).toBe('b');
  });

  it('does not insert hour-dividers in other date groups', () => {
    const items = [
      makeItem('c', JAN_2),
      makeItem('b', JAN_1_14PM),
      makeItem('a', JAN_1_10AM),
    ];
    const rows = buildGalleryRows(items, 3, JAN_1_10AM);

    // JAN_2 group should have no hour-dividers — slice only its own rows
    const jan2DivIdx = rows.findIndex((r) => r.type === 'divider' && r.date.getDate() === 2);
    const nextDivIdx = rows.findIndex((r, i) => i > jan2DivIdx && r.type === 'divider');
    const jan2Rows = rows.slice(jan2DivIdx + 1, nextDivIdx === -1 ? undefined : nextDivIdx);
    expect(jan2Rows.every((r) => r.type !== 'hour-divider')).toBe(true);
  });
});
