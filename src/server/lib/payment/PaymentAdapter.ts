// ---------------------------------------------------------------------------
// Payment Provider Port — Ports & Adapters pattern
//
// Services depend on this interface, not on any concrete SDK.
// Swap providers by swapping the adapter — zero changes to business logic.
// ---------------------------------------------------------------------------

export interface CreateCheckoutParams {
  orderId: string;
  itemIds: string[];
  totalCents: number;
  itemCount: number;
  successUrl: string;
}

export interface CheckoutSessionResult {
  checkoutUrl: string;
}

/**
 * Normalised webhook event — provider-agnostic shape.
 * customData carries whatever we embedded at checkout time (orderId, itemIds).
 */
export interface PaymentWebhookEvent {
  /** Normalised event type. Adapters map provider-specific names to these. */
  type: 'order.completed';
  /** Provider's own order identifier — stored as externalOrderId in our DB. */
  externalOrderId: string;
  customData: {
    orderId: string;
    itemIds: string[];
  };
}

export type PaymentAdapter = {
  /**
   * Creates a hosted checkout session and returns a redirect URL.
   * All pricing must be passed in — provider must not be queried for prices.
   */
  createCheckoutSession(params: CreateCheckoutParams): Promise<CheckoutSessionResult>;

  /**
   * Verifies the webhook request came from the trusted provider.
   * Receives the full headers map so each adapter can extract its own
   * signature header (providers use different header names).
   * Must use constant-time comparison to prevent timing attacks.
   */
  verifyWebhook(rawBody: string, headers: Record<string, string>): boolean;

  /**
   * Parses the raw webhook body into a normalised PaymentWebhookEvent.
   * Called only after verifyWebhook returns true.
   */
  parseWebhookEvent(rawBody: string): PaymentWebhookEvent;
}
