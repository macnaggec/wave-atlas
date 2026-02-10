'use server';

import type { AuthActionState } from '../types';
import { registerSchema } from '../schemas/auth';
import { AuthService } from '../services/auth.service';
import { isHttpError, ConflictError } from 'shared/errors';

export async function registerAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  // 1. Parse FormData
  const rawData = {
    name: formData.get('name') as string,
    email: formData.get('email') as string,
    password: formData.get('password') as string,
    confirmPassword: formData.get('confirmPassword') as string,
  };

  // 2. Validate with Zod schema
  const validation = registerSchema.safeParse(rawData);

  if (!validation.success) {
    const firstError = validation.error.issues[0];
    return { success: false, error: firstError.message };
  }

  const { name, email, password } = validation.data;

  try {
    // 3. Business logic - check if user exists
    const exists = await AuthService.userExists(email);
    if (exists) {
      throw new ConflictError('User with this email already exists');
    }

    // 4. Create user
    await AuthService.createUser({ name, email, password });

    return { success: true };
  } catch (error) {
    console.error('Registration error:', error);

    // Use project's error handling system
    if (isHttpError(error)) {
      return { success: false, error: error.message };
    }

    return { success: false, error: 'An unexpected error occurred' };
  }
}
