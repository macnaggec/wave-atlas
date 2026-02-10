import { prisma } from 'shared/api/prismaClient';
import { hash } from 'bcryptjs';
import type { RegisterInput } from '../schemas/auth';

export class AuthService {
  /**
   * Check if user with given email already exists
   */
  static async userExists(email: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    return !!user;
  }

  /**
   * Create a new user account
   */
  static async createUser(data: Omit<RegisterInput, 'confirmPassword'>): Promise<{ id: string; email: string }> {
    const hashedPassword = await hash(data.password, 12);

    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashedPassword,
      },
      select: {
        id: true,
        email: true,
      },
    });

    return user;
  }

  /**
   * Validate password strength (can be extended)
   */
  static validatePasswordStrength(password: string): { valid: boolean; message?: string } {
    if (password.length < 6) {
      return {
        valid: false,
        message: 'Password must be at least 6 characters'
      };
    }

    // Add more rules as needed:
    // - Contains uppercase
    // - Contains number
    // - Contains special character

    return { valid: true };
  }
}
