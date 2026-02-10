/**
 * Custom Hook for User Session
 *
 * Provides easy access to Auth.js session data in client components.
 * Replaces the old Redux-based user state.
 */

"use client";

import { useSession } from "next-auth/react";

export function useUser() {
  const { data: session, status } = useSession();

  const isAuthenticated = Boolean(session?.user) && status !== "loading";

  return {
    user: session?.user || null,
    isLoading: status === "loading",
    isAuthenticated,
  };
}
