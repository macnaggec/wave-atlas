import { cache } from 'react'
import { auth } from '../../../auth'

type User = {
  id: string;
  name: string;
  email: string;
  photo?: string;
  role?: string;
  balance?: string;
};

/**
 * Cached helper function to get current user from Auth.js session.
 * Using React's cache ensures the same user data is returned
 * across multiple calls within the same render cycle.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  try {
    const session = await auth();

    if (!session?.user) {
      return null;
    }

    return {
      id: session.user.id,
      email: session.user.email || "",
      name: session.user.name || "",
      photo: session.user.image || undefined,
      balance: session.user.balance,
      role: undefined, // Add if you extend session with role
    };
  } catch (error) {
    console.error('Failed to get current user:', error);
    return null;
  }
})

/**
 * Get authentication status
 */
export const getAuthStatus = cache(async (): Promise<boolean> => {
  const session = await auth();
  return !!session?.user;
})

/**
 * Role-based access control helper
 */
export const hasRole = cache(async (requiredRole: string): Promise<boolean> => {
  const user = await getCurrentUser()
  return user?.role === requiredRole
})
