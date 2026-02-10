/**
 * Auth.js Session Provider Wrapper
 *
 * Wraps the app with SessionProvider to enable:
 * - useSession() hook in client components
 * - Automatic session management
 * - Session persistence across page refreshes
 */

"use client";

import { SessionProvider } from "next-auth/react";
import type { ProviderHOC } from '../types';

export const withSession: ProviderHOC = (Component) => {
  return function WithSessionProvider(props) {
    return (
      <SessionProvider>
        <Component {...props} />
      </SessionProvider>
    );
  };
};
