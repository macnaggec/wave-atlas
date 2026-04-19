import { vi } from 'vitest'
import { mockDeep } from 'vitest-mock-extended'

// ---------------------------------------------------------------------------
// Server module mocks — applied globally to every server test so individual
// test files don't need their own vi.mock() boilerplate.
// Typed accessors live in src/test/setup/ (prisma.ts, payment.ts).
// ---------------------------------------------------------------------------

vi.mock('server/db', () => ({
  prisma: mockDeep(),
}))

vi.mock('server/lib/payment/activeAdapter', () => ({
  paymentAdapter: {
    createCheckoutSession: vi.fn(),
    verifyWebhook: vi.fn(),
    parseWebhookEvent: vi.fn(),
  },
}))
