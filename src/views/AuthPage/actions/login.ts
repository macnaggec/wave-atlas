'use server';

import { signIn } from '../../../../auth';
import { AuthError } from 'next-auth';
import type { AuthActionState } from '../types';
import { loginSchema } from '../schemas/auth';
import { getAuthErrorMessage, isHttpError } from 'shared/errors';

export async function loginAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  // 1. Parse FormData
  const rawData = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  };

  // 2. Validate with Zod schema
  const validation = loginSchema.safeParse(rawData);

  if (!validation.success) {
    const firstError = validation.error.issues[0];
    return { success: false, error: firstError.message };
  }

  const { email, password } = validation.data;

  try {
    // 3. Authenticate with server-side redirect
    await signIn('credentials', {
      email,
      password,
      redirectTo: '/', // NextAuth will redirect after successful auth
    });
  } catch (error) {
    // Use project's error handling system
    if (isHttpError(error)) {
      return { success: false, error: error.message };
    }

    // Map NextAuth errors to user-friendly messages
    if (error instanceof AuthError) {
      const errorMessage = getAuthErrorMessage(error);
      return { success: false, error: errorMessage };
    }

    // Rethrow redirect errors and other unexpected system errors
    throw error;
  }

  // TypeScript requires a return here, but this line is unreachable in practice
  // because signIn() with redirectTo either redirects (stops execution) or throws (caught above)
  return { success: false, error: 'Unexpected error' };
}
