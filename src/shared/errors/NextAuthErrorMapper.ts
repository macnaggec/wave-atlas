/**
 * Auth Error Handler
 * Bridges NextAuth errors to our application's error system
 */

import { AuthError } from 'next-auth';
import { UnauthorizedError, BadRequestError } from 'shared/errors';

/**
 * Maps NextAuth errors to application HttpErrors
 */
export function mapAuthError(error: unknown): never {
  if (error instanceof AuthError) {
    switch (error.type) {
      case 'CredentialsSignin':
        throw new UnauthorizedError('Invalid email or password');
      case 'CallbackRouteError':
        throw new UnauthorizedError('Authentication failed');
      case 'OAuthSignInError':
      case 'OAuthCallbackError':
        throw new BadRequestError('OAuth authentication failed');
      default:
        throw new BadRequestError('Authentication error');
    }
  }

  // Unknown error
  throw new BadRequestError('An unexpected error occurred during authentication');
}

/**
 * Handles NextAuth AuthError and returns user-friendly message
 * Use in server actions that don't need to throw
 */
export function getAuthErrorMessage(error: unknown): string {
  if (error instanceof AuthError) {
    switch (error.type) {
      case 'CredentialsSignin':
        return 'Invalid email or password';
      case 'CallbackRouteError':
        return 'Authentication failed';
      case 'OAuthSignInError':
      case 'OAuthCallbackError':
        return 'OAuth authentication failed';
      default:
        return 'Something went wrong';
    }
  }

  return 'An unexpected error occurred';
}
