// ---------------------------------------------------------------------------
// Mock Payment Adapter — test infrastructure only.
//
// Never imported by production code. Inject via tests directly into services
// that accept a PaymentAdapter, or use the typed mock from test/setup/payment.ts.
//
// To simulate a completed webhook in a test, call parseWebhookEvent with a
// plain JSON body: { orderId, itemIds, externalOrderId }.
// ---------------------------------------------------------------------------

import type {
  PaymentAdapter,
  CreateCheckoutParams,
  CheckoutSessionResult,
  PaymentWebhookEvent,
} from 'server/lib/payment/PaymentAdapter';

function createCheckoutSession(
  params: CreateCheckoutParams
): Promise<CheckoutSessionResult> {
  return Promise.resolve({
    checkoutUrl: `https://mock-payment.test/checkout?orderId=${params.orderId}&total=${params.totalCents}`,
  });
}

function verifyWebhook(_rawBody: string, _headers: Record<string, string>): boolean {
  return true;
}

function parseWebhookEvent(rawBody: string): PaymentWebhookEvent {
  const body = JSON.parse(rawBody) as {
    orderId: string;
    itemIds?: string[];
    externalOrderId?: string;
  };

  return {
    type: 'order.completed',
    externalOrderId: body.externalOrderId ?? `mock-${Date.now()}`,
    customData: {
      orderId: body.orderId,
    },
  };
}

export const mockPaymentAdapter: PaymentAdapter = {
  createCheckoutSession,
  verifyWebhook,
  parseWebhookEvent,
};
