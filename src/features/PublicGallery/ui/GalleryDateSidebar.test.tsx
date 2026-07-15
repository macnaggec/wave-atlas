import { render, screen } from '@testing-library/react';
import type { RefObject } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { GalleryDateSidebar } from './GalleryDateSidebar';
import type { VirtualGalleryHandle } from 'shared/ui/VirtualGallery/VirtualGallery';

function galleryRef() {
  return {
    current: {
      scrollToIndex: vi.fn(),
    },
  } satisfies RefObject<VirtualGalleryHandle | null>;
}

function mockDateLabels(labelsByTimestamp: Map<number, { month: string; day: string; title: string }>) {
  return vi.spyOn(Date.prototype, 'toLocaleDateString').mockImplementation(function (
    this: Date,
    _locales?: Intl.LocalesArgument,
    options?: Intl.DateTimeFormatOptions,
  ) {
    const label = labelsByTimestamp.get(this.getTime());
    if (!label) return '';
    if (options?.month === 'short' && options?.day === 'numeric' && options?.year === 'numeric') {
      return label.title;
    }
    if (options?.month === 'short') return label.month;
    if (options?.day === 'numeric') return label.day;
    return label.title;
  });
}

describe('GalleryDateSidebar', () => {
  beforeAll(() => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders one jump target per calendar day', () => {
    render(
      <GalleryDateSidebar
        highlights={[
          { date: new Date('2026-06-24T06:00:00.000Z'), rowIndex: 0 },
          { date: new Date('2026-06-24T09:00:00.000Z'), rowIndex: 4 },
          { date: new Date('2026-06-25T06:00:00.000Z'), rowIndex: 8 },
        ]}
        firstVisibleIndex={0}
        galleryRef={galleryRef()}
      />,
    );

    expect(screen.getAllByRole('button')).toHaveLength(2);
  });

  it('deduplicates shortcuts by the visible calendar date', () => {
    const lateUtc = new Date('2026-06-23T22:30:00.000Z');
    const sameVisibleDay = new Date('2026-06-24T06:00:00.000Z');
    const nextVisibleDay = new Date('2026-06-25T06:00:00.000Z');
    mockDateLabels(new Map([
      [lateUtc.getTime(), { month: 'Jun', day: '24', title: 'Jun 24, 2026' }],
      [sameVisibleDay.getTime(), { month: 'Jun', day: '24', title: 'Jun 24, 2026' }],
      [nextVisibleDay.getTime(), { month: 'Jun', day: '25', title: 'Jun 25, 2026' }],
    ]));

    render(
      <GalleryDateSidebar
        highlights={[
          { date: lateUtc, rowIndex: 0 },
          { date: sameVisibleDay, rowIndex: 4 },
          { date: nextVisibleDay, rowIndex: 8 },
        ]}
        firstVisibleIndex={0}
        galleryRef={galleryRef()}
      />,
    );

    expect(screen.getAllByRole('button')).toHaveLength(2);
    expect(screen.getAllByRole('button').map((button) => button.getAttribute('title'))).toEqual([
      'Jun 24, 2026',
      'Jun 25, 2026',
    ]);
  });
});
