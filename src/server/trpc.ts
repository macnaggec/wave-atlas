import { initTRPC, TRPCError } from '@trpc/server';
import type { Context } from 'hono';
import superjson from 'superjson';
import { ZodError } from 'zod';
import { auth } from 'server/auth';
import { isHttpError } from 'shared/errors';

type SessionResult = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>;

export type TRPCContext = {
  session: SessionResult['session'] | null;
  user: SessionResult['user'] | null;
  clientIp: string;
};

export async function createContext(c: Context): Promise<TRPCContext> {
  const session = await auth.api
    .getSession({ headers: c.req.raw.headers })
    .catch(() => null);
  const clientIp =
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
    c.req.header('cf-connecting-ip') ??
    'unknown';
  return {
    session: session?.session ?? null,
    user: session?.user ?? null,
    clientIp,
  };
}

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    const cause = error.cause;
    if (isHttpError(cause)) {
      const httpToCode: Record<number, TRPCError['code']> = {
        401: 'UNAUTHORIZED',
        403: 'FORBIDDEN',
        404: 'NOT_FOUND',
        409: 'CONFLICT',
        429: 'TOO_MANY_REQUESTS',
      };
      const code: TRPCError['code'] =
        httpToCode[cause.statusCode] ??
        (cause.statusCode < 500 ? 'BAD_REQUEST' : 'INTERNAL_SERVER_ERROR');
      return { ...shape, message: cause.message, data: { ...shape.data, code } };
    }
    // Zod input validation errors — extract first human-readable issue message
    if (cause instanceof ZodError) {
      const message = cause.issues[0]?.message ?? 'Invalid input';
      return { ...shape, message };
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
