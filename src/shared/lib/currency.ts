/**
 * Formats a price in cents to a display string.
 * Returns "Free" for zero, otherwise "$X.XX".
 *
 * @example
 * formatPrice(0)    // "Free"
 * formatPrice(300)  // "$3.00"
 * formatPrice(1050) // "$10.50"
 */
export function formatPrice(cents: number): string {
  if (cents === 0) return 'Free';
  return `$${(cents / 100).toFixed(2)}`;
}
