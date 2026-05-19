import type { Hono } from 'hono';
import { paymentAdapter } from 'server/lib/payment/activeAdapter';
import { purchaseFulfillmentService } from 'server/services/PurchaseFulfillmentService';
import { createRateLimiter } from 'server/lib/rateLimiter';
import { getClientIp } from 'server/lib/getClientIp';
import { logger } from 'shared/lib/logger';

// 20 webhook requests per IP per minute — prevents replay-flood DoS
const webhookLimiter = createRateLimiter({ windowMs: 60_000, max: 20 });

export function registerCryptoCloudWebhook(app: Hono) {
  app.post('/api/webhook/cryptocloud', async (c) => {
    try {
      webhookLimiter(getClientIp(c));
    } catch {
      return c.json({ error: 'Too many requests' }, 429);
    }

    const rawBody = await c.req.text();
    const headers = Object.fromEntries(c.req.raw.headers.entries());

    if (!paymentAdapter.verifyWebhook(rawBody, headers)) {
      return c.json({ error: 'Invalid signature' }, 401);
    }

    const event = paymentAdapter.parseWebhookEvent(rawBody);
    if (event.type === 'order.completed') {
      try {
        await purchaseFulfillmentService.fulfillOrder(
          event.customData.orderId,
          event.externalOrderId,
        );
      } catch (err) {
        logger.error('[webhook] Fulfillment failed', { err });
        return c.json({ error: 'Fulfillment error' }, 500);
      }
    }

    return c.json({ ok: true });
  });
}
