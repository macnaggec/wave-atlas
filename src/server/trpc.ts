import { initTRPC, TRPCError } from '@trpc/server';
import { UserRole } from '@prisma/client';
import type { Context } from 'hono';
import superjson from 'superjson';
import { auth } from 'server/auth';
import { prisma } from 'server/db';
import { isHttpError } from 'shared/errors';
import { logger } from 'shared/lib/logger';

type GetSessionResult = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>;
type ContextUser = GetSessionResult['user'] & { role?: UserRole };

export type TRPCContext = {
  session: GetSessionResult['session'] | null;
  user: ContextUser | null;
};

export async function createContext(c: Context): Promise<TRPCContext> {
  const session = await auth.api
    .getSession({ headers: c.req.raw.headers })
    .catch((err) => {
      logger.warn('[trpc] auth session retrieval failed', { err });
      return null;
    });

  const authUser = session?.user ?? null;
  const dbUser = authUser
    ? await prisma.user.findUnique({
      where: { id: authUser.id },
      select: { role: true },
    }).catch((err) => {
      logger.warn('[trpc] user role retrieval failed', { err });
      return null;
    })
    : null;

  return {
    session: session?.session ?? null,
    user: authUser ? { ...authUser, role: dbUser?.role } : null,
  };
}

const STATUS_TO_CODE: Record<number, TRPCError['code']> = {
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  429: 'TOO_MANY_REQUESTS',
};

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    const cause = error.cause;
    if (isHttpError(cause)) {
      const code: TRPCError['code'] =
        STATUS_TO_CODE[cause.statusCode] ??
        (cause.statusCode < 500 ? 'BAD_REQUEST' : 'INTERNAL_SERVER_ERROR');
      return { ...shape, message: cause.message, data: { ...shape.data, code } };
    }
    return shape;
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
  return next({ ctx: { ...ctx, user: ctx.user } });
});
export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== UserRole.ADMIN) throw new TRPCError({ code: 'FORBIDDEN' });
  return next({ ctx });
});
