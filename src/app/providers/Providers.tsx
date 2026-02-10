/**
 * Client-Side Providers Composition
 *
 * Uses HOC composition pattern for clean, non-nested provider setup.
 * All providers are client-side only - no server/client mixing.
 */

"use client";

import compose from "compose-function";
import { withSession } from "./SessionProvider/withSession";
import { withMantine } from "./MantineProvider/withMantine";

/**
 * Composed Providers
 *
 * Order matters:
 * 1. withMantine - UI theme
 * 2. withSession - Auth.js session (outermost)
 */
export const Providers = compose(
  withSession,  // SessionProvider wraps everything
  withMantine,  // MantineProvider
)(({ children }: { children: React.ReactNode }) => <>{children}</>);
