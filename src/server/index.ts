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
import { registerCryptoCloudWebhook } from 'server/webhooks/cryptocloud';

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
registerCryptoCloudWebhook(app);

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
