import { initTRPC, TRPCError } from '@trpc/server';
import type { Context } from 'hono';
import superjson from 'superjson';
import { auth } from 'server/auth';
import { isHttpError } from 'shared/errors';

type GetSessionResult = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>;

export type TRPCContext = {
  session: GetSessionResult['session'] | null;
  user: GetSessionResult['user'] | null;
};

export async function createContext(c: Context): Promise<TRPCContext> {
  const session = await auth.api
    .getSession({ headers: c.req.raw.headers })
    .catch(() => null);
  return {
    session: session?.session ?? null,
    user: session?.user ?? null,
  };
}

const STATUS_TO_CODE: Record<number, TRPCError['code']> = {
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
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
