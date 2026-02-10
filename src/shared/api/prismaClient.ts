/**
 * Prisma Client Singleton
 *
 * In development, Next.js hot-reloads can create multiple PrismaClient instances,
 * which exhausts database connections. This pattern ensures only one instance exists.
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);

/**
 * Reuse existing client in development, create new in production
 */
export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  adapter,
  log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
});

/**
 * Save to global in development to persist across hot reloads
 */
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
