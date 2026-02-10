import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "shared/api/prismaClient";

/**
 * Auth.js Configuration
 *
 * This is the core authentication setup for the application.
 * Uses JWT sessions (stored in encrypted cookies) for stateless auth.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  /**
   * Session Strategy
   * - "jwt": Sessions stored as encrypted tokens in cookies (no DB reads)
   * - Fast, scalable, works great for most apps
   */
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  /**
   * Authentication Providers
   * Currently using Credentials (email/password)
   * Can add OAuth providers (Google, GitHub) later
   */
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },

      /**
       * authorize() - Called when user submits login form
       *
       * @returns User object if valid, null if invalid
       * Throwing errors shows them on the login page
       */
      async authorize(credentials) {
        // Validate input
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password required");
        }

        // Find user in database
        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
          select: {
            id: true,
            email: true,
            name: true,
            password: true, // Need password to verify
            balance: true,
          }
        });

        // User not found
        if (!user) {
          throw new Error("Invalid email or password");
        }

        // No password set (OAuth user trying to use credentials)
        if (!user.password) {
          throw new Error("Please sign in with your social account");
        }

        // Verify password
        const isValid = await compare(
          credentials.password as string,
          user.password
        );

        if (!isValid) {
          throw new Error("Invalid email or password");
        }

        // Return user without password (never expose password)
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          balance: user.balance.toString(), // Convert Decimal to string
        };
      }
    })
  ],

  /**
   * Callbacks - Customize session/token behavior
   *
   * Flow: authorize() → jwt() → session()
   */
  callbacks: {
    /**
     * jwt() - Called whenever JWT is created or updated
     *
     * @param token - The JWT token
     * @param user - User object from authorize() (only on sign-in)
     * @returns Modified token
     */
    async jwt({ token, user }) {
      // On sign-in, add user data to token
      if (user) {
        token.userId = user.id;
        token.balance = user.balance;
      }
      return token;
    },

    /**
     * session() - Called whenever session is checked (useSession, auth())
     *
     * @param session - The session object sent to client
     * @param token - The JWT token
     * @returns Modified session (this is what client receives)
     */
    async session({ session, token }) {
      // Add custom fields to session
      if (token.userId) {
        session.user.id = token.userId as string;
        session.user.balance = token.balance as string;
      }
      return session;
    },
  },

  /**
   * Pages - Customize Auth.js UI pages
   */
  pages: {
    signIn: "/auth", // Your custom login page
    // signOut: "/auth/signout",
    // error: "/auth/error",
  },

  /**
   * Debug mode - Shows detailed logs in development
   */
  debug: process.env.NODE_ENV === "development",
});
