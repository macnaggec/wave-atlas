/**
 * Auth.js API Route Handler
 *
 * This catch-all route handles ALL Auth.js endpoints:
 * - GET  /api/auth/signin       - Sign in page
 * - POST /api/auth/signin       - Submit credentials
 * - POST /api/auth/signout      - Sign out
 * - GET  /api/auth/session      - Get current session
 * - GET  /api/auth/csrf         - CSRF token
 * - GET  /api/auth/providers    - List auth providers
 * - POST /api/auth/callback/*   - OAuth callbacks
 */

import { handlers } from "../../../../auth";

/**
 * Export handlers from auth.ts
 * Auth.js provides GET and POST handlers
 */
export const { GET, POST } = handlers;
