// ---------------------------------------------------------------------------
// Active payment adapter — change this import to swap providers.
// Everything else in the codebase imports from here, not from a concrete adapter.
// ---------------------------------------------------------------------------

export { cryptoCloudAdapter as paymentAdapter } from 'server/lib/payment/CryptoCloudAdapter';
