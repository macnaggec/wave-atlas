// ---------------------------------------------------------------------------
// Active payment adapter — change PAYMENT_PROVIDER env var to swap providers.
// Everything else in the codebase imports from here, not from a concrete adapter.
// ---------------------------------------------------------------------------

import { cryptoCloudAdapter } from 'server/lib/payment/CryptoCloudAdapter';
import { mockPaymentAdapter } from 'server/lib/payment/MockPaymentAdapter';

export const paymentAdapter =
  process.env.PAYMENT_PROVIDER === 'mock' ? mockPaymentAdapter : cryptoCloudAdapter;
