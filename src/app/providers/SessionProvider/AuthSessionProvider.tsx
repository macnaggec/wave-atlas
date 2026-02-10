/**
 * Auth Session Provider Client Component
 *
 * Wraps children with Auth.js SessionProvider.
 * Must be a separate client component to use in server layouts.
 */

"use client";

import { SessionProvider } from "next-auth/react";

export function AuthSessionProvider({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
