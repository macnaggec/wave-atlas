import { describe, it, expect, vi, beforeEach } from 'vitest';
import { redirect } from 'next/navigation';
import type { Session } from 'next-auth';
import AuthPageRoute from '../page';

/**
 * Test Suite: Auth Page Route
 *
 * Purpose: Verify that authenticated users are redirected away from the
 * registration/login page, while unauthenticated users can access it.
 *
 * Security: Prevents authenticated users from creating duplicate accounts.
 * UX: Avoids confusion by not showing login forms to logged-in users.
 */

// Mock next/navigation
vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

// Mock auth function
vi.mock('../../../auth', () => ({
  auth: vi.fn<() => Promise<Session | null>>(),
}));

// Mock AuthPage component
vi.mock('views/AuthPage', () => ({
  AuthPage: () => <div data-testid="auth-page">Auth Page</div>,
}));

import { auth } from '../../../auth';

describe('AuthPageRoute - Authentication Guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Authenticated User Behavior', () => {
    it('should redirect authenticated users to home page', async () => {
      // Arrange: Simulate authenticated session
      (auth as any).mockResolvedValue({
        user: {
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
        },
        expires: '2026-12-31T23:59:59.999Z',
      });

      // Act: Call the page component
      await AuthPageRoute();

      // Assert: Should redirect to home
      expect(redirect).toHaveBeenCalledWith('/');
      expect(redirect).toHaveBeenCalledTimes(1);
    });

    it('should redirect users with partial session data', async () => {
      // Arrange: Session with minimal user data
      (auth as any).mockResolvedValue({
        user: {
          id: 'user-456',
          email: 'user@example.com',
          name: null,
        },
        expires: '2026-12-31T23:59:59.999Z',
      });

      // Act
      await AuthPageRoute();

      // Assert: Should still redirect (user.id exists)
      expect(redirect).toHaveBeenCalledWith('/');
    });
  });

  describe('Unauthenticated User Behavior', () => {
    it('should render auth page for unauthenticated users', async () => {
      // Arrange: No session
      (auth as any).mockResolvedValue(null);

      // Act: Render the page
      const result = await AuthPageRoute();

      // Assert: Should NOT redirect
      expect(redirect).not.toHaveBeenCalled();

      // Should return JSX element (AuthPage wrapped in Suspense)
      expect(result).toBeDefined();
      expect(result.type.toString()).toContain('react.suspense');
    });

    it('should render auth page when session exists but user is missing', async () => {
      // Arrange: Malformed session (edge case - session without user)
      (auth as any).mockResolvedValue({
        expires: '2026-12-31T23:59:59.999Z',
      } as any);

      // Act
      await AuthPageRoute();

      // Assert: Should NOT redirect (no user object)
      expect(redirect).not.toHaveBeenCalled();
    });

    it('should render auth page when user object is missing required fields', async () => {
      // Arrange: Session exists but user object is undefined/null
      (auth as any).mockResolvedValue({
        user: undefined as any,
        expires: '2026-12-31T23:59:59.999Z',
      } as any);

      // Act
      await AuthPageRoute();

      // Assert: Should NOT redirect (session.user is falsy)
      expect(redirect).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle auth() rejection gracefully', async () => {
      // Arrange: Auth service throws error
      (auth as any).mockRejectedValue(new Error('Auth service unavailable'));

      // Act & Assert: Should throw error (no try-catch in page)
      await expect(AuthPageRoute()).rejects.toThrow('Auth service unavailable');

      // Should not have called redirect before error
      expect(redirect).not.toHaveBeenCalled();
    });
  });

  describe('Integration with Next.js Behavior', () => {
    it('should use Next.js redirect which throws RedirectError', async () => {
      // Note: In real Next.js, redirect() throws a NEXT_REDIRECT error
      // This is expected behavior - not an exception to catch
      (auth as any).mockResolvedValue({
        user: { id: '1', email: 'user@example.com', name: 'User' },
        expires: '2026-12-31T23:59:59.999Z',
      });

      // Simulate Next.js redirect behavior
      const redirectError = new Error('NEXT_REDIRECT');
      (redirectError as any).digest = 'NEXT_REDIRECT;replace;/';
      (redirect as any).mockImplementation(() => {
        throw redirectError;
      });

      // Act & Assert: Next.js redirect throws (this is normal)
      await expect(AuthPageRoute()).rejects.toThrow('NEXT_REDIRECT');
    });
  });
});
