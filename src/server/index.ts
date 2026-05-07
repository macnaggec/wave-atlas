import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { trpcServer } from '@hono/trpc-server';
import { auth } from 'server/auth';
import { appRouter } from 'server/router';
import { createContext } from 'server/trpc';
import { paymentAdapter } from 'server/lib/payment/activeAdapter';
import { purchaseFulfillmentService } from 'server/services/PurchaseFulfillmentService';
import { createRateLimiter } from 'server/lib/rateLimiter';
import { logger } from 'shared/lib/logger';

// 20 webhook requests per IP per minute — prevents replay-flood DoS
const webhookLimiter = createRateLimiter({ windowMs: 60_000, max: 20 });

const app = new Hono();

const isProd = process.env.NODE_ENV === 'production';
const clientUrl = process.env.CLIENT_URL ?? 'http://localhost:3000';

app.use('/api/*', cors({
  origin: clientUrl,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// Better Auth — handles /api/auth/* (sign in, sign up, session, sign out)
app.on(['GET', 'POST'], '/api/auth/**', (c) => auth.handler(c.req.raw));

// tRPC
app.use('/api/trpc/*', trpcServer({
  router: appRouter,
  createContext: (_opts, c) => createContext(c),
}));

app.get('/api/health', (c) => c.json({ ok: true }));

// CryptoCloud webhook — raw body required for HMAC verification, must NOT go through tRPC
app.post('/api/webhook/cryptocloud', async (c) => {
  const ip =
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
    c.req.header('cf-connecting-ip') ??
    'unknown';

  try {
    webhookLimiter(ip);
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

// Serve Vite SPA in production
if (isProd) {
  const distPath = resolve(process.cwd(), 'dist/client');
  app.use('/*', serveStatic({ root: './dist/client' }));
  const indexHtml = readFileSync(resolve(distPath, 'index.html'), 'utf-8');
  app.get('*', (c) => c.html(indexHtml));
}

serve({ fetch: app.fetch, port: 3001 }, () => {
  console.log('Server running on http://localhost:3001');
});

