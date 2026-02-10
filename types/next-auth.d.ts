/**
 * Type Extensions for Auth.js (NextAuth)
 *
 * This file extends the default Auth.js types to include
 * custom fields we add to the session and JWT token.
 */

import { DefaultSession, DefaultJWT } from "next-auth";
import { DefaultJWT as JWT } from "next-auth/jwt";

declare module "next-auth" {
  /**
   * Extend the Session interface
   * This is what you get from useSession() and auth()
   */
  interface Session {
    user: {
      id: string;
      balance?: string; // User balance (stored as string)
    } & DefaultSession["user"]; // Keeps email, name, image
  }

  /**
   * Extend the User interface
   * This is what authorize() returns
   */
  interface User {
    id: string;
    email: string;
    name?: string | null;
    balance?: string;
  }
}

declare module "next-auth/jwt" {
  /**
   * Extend the JWT interface
   * This is the token payload stored in the cookie
   */
  interface JWT extends DefaultJWT {
    userId?: string;
    balance?: string;
  }
}
