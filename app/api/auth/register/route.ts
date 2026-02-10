/**
 * User Registration API Route
 *
 * POST /api/auth/register
 * Creates a new user with hashed password in Prisma DB
 */

import { hash } from "bcryptjs";
import { prisma } from "shared/api/prismaClient";
import { createApiRoute } from "shared/lib/safeApi";
import { z } from "zod";

const registerSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().optional(),
});

export const POST = createApiRoute(
  registerSchema,
  async ({ body }) => {
    // Hash password with bcrypt (10 rounds is secure and fast)
    const hashedPassword = await hash(body.password, 10);

    // Create user in Prisma database
    const user = await prisma.user.create({
      data: {
        email: body.email.toLowerCase().trim(),
        password: hashedPassword,
        name: body.name?.trim() || null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      }
    });

    return {
      message: "User created successfully",
      user
    };
  }
);
