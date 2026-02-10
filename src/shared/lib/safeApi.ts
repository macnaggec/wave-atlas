import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "../../../auth";
import { BadRequestError, UnauthorizedError } from "shared/errors";
import { withErrorHandler } from "shared/api/errorHandler";

type ApiContext = {
  user?: {
    id: string;
    email?: string | null;
    name?: string | null;
  };
  params: Record<string, string | string[]>;
};

type ApiHandler<TBody, TOutput> = (
  input: { body: TBody; params: Record<string, string | string[]> },
  ctx: ApiContext
) => Promise<TOutput>;

/**
 * Creates a safe API Route handler with input validation and context injection
 */
export function createApiRoute<TBody>(
  schema: z.Schema<TBody>,
  handler: ApiHandler<TBody, any>
) {
  return withErrorHandler(async (
    req: NextRequest,
    { params }: { params: Promise<any> }
  ) => {
    // 1. Parse Body
    let body: any;
    try {
      if (req.method !== 'GET' && req.method !== 'DELETE') {
        body = await req.json();
      }
    } catch {
      throw new BadRequestError("Invalid JSON body");
    }

    // 2. Validate Input
    const result = schema.safeParse(body);
    if (!result.success) {
      throw new BadRequestError("Invalid input", { errors: result.error.flatten() });
    }

    // 3. Get Session
    const session = await auth();
    const resolvedParams = await params || {};

    // 4. Run Handler
    const responseData = await handler(
      { body: result.data, params: resolvedParams },
      {
        user: session?.user ? {
          id: session.user.id,
          email: session.user.email,
          name: session.user.name,
        } : undefined,
        params: resolvedParams
      }
    );

    return NextResponse.json(responseData, { status: 200 });
  });
}
