import type { MediaItem } from 'entities/Media/types';
import { isSameCalendarDay } from './dateUtils';

export type GalleryRow =
  | { type: 'divider'; date: Date; key: string; mediaRowCount: number }
  | { type: 'hour-divider'; date: Date; hour: number; key: string }
  | { type: 'media'; items: MediaItem[]; key: string };

/**
 * Builds a flat list of rows for the virtual gallery.
 *
 * @param items       Items sorted capturedAt DESC (as returned by the API).
 * @param columns     Number of cards per media row (default 3).
 * @param expandedDate When set, inserts hour-level dividers within that day
 *                    so the sidebar can show an hour scrubber.
 */
export function buildGalleryRows(
  items: MediaItem[],
  columns = 3,
  expandedDate?: Date | null,
): GalleryRow[] {
  if (items.length === 0) return [];

  const rows: GalleryRow[] = [];
  let groupStart = 0;

  while (groupStart < items.length) {
    const groupDate = items[groupStart]!.capturedAt;

    let groupEnd = groupStart + 1;
    while (groupEnd < items.length && isSameCalendarDay(items[groupEnd]!.capturedAt, groupDate)) {
      groupEnd++;
    }

    const groupItems = items.slice(groupStart, groupEnd);
    const mediaRowCount = Math.ceil(groupItems.length / columns);

    rows.push({ type: 'divider', date: groupDate, key: `divider-${groupDate.toISOString()}`, mediaRowCount });

    if (expandedDate && isSameCalendarDay(expandedDate, groupDate)) {
      // Items arrive DESC — reverse to get chronological order within the day
      const chronological = [...groupItems].reverse();

      let hourStart = 0;
      while (hourStart < chronological.length) {
        const hour = chronological[hourStart]!.capturedAt.getUTCHours();
        let hourEnd = hourStart + 1;
        while (hourEnd < chronological.length && chronological[hourEnd]!.capturedAt.getUTCHours() === hour) {
          hourEnd++;
        }
        const hourItems = chronological.slice(hourStart, hourEnd);
        rows.push({ type: 'hour-divider', date: groupDate, hour, key: `hour-${groupDate.toISOString()}-${hour}` });
        for (let i = 0; i < hourItems.length; i += columns) {
          const chunk = hourItems.slice(i, i + columns);
          rows.push({ type: 'media', items: chunk, key: `media-${chunk[0]!.id}` });
        }
        hourStart = hourEnd;
      }
    } else {
      for (let i = 0; i < groupItems.length; i += columns) {
        const chunk = groupItems.slice(i, i + columns);
        rows.push({ type: 'media', items: chunk, key: `media-${chunk[0]!.id}` });
      }
    }

    groupStart = groupEnd;
  }

  return rows;
}
