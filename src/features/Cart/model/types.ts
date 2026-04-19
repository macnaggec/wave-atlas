export interface CartItem {
  /** Opaque item identifier — the purchasing layer resolves what it points to */
  id: string;
  /** Human-readable label shown in cart UI (e.g. "Uluwatu · Apr 1, 2026") */
  label: string;
  thumbnailUrl: string;
  /** Price in cents (e.g. 300 = $3.00). Integer to avoid floating-point errors. */
  priceCents: number;
}
