/** Pure date utility functions */

export const isSameCalendarDay = (a: Date, b: Date): boolean =>
  a.getUTCFullYear() === b.getUTCFullYear() &&
  a.getUTCMonth() === b.getUTCMonth() &&
  a.getUTCDate() === b.getUTCDate();

/** "Apr 1, 2026" — short human-readable date for media cards and cart labels */
export const formatShortDate = (date: Date | string): string =>
  new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
