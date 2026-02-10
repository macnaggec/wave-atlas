import { auth } from "../../../auth";
import { z } from "zod";
import type { Session } from "next-auth";
import { UnauthorizedError, BadRequestError, InternalServerError } from "shared/errors";
import { withServerErrorHandler, withServerResultHandler, type ActionResult } from "shared/api/errorHandler";

/**
 * Type definition for the action handler
 */
type ActionHandler<TInput, TOutput> = (input: TInput, ctx: ActionContext) => Promise<TOutput>;

interface ActionOptions {
  auth?: "optional" | "none";
  assertSerializable?: boolean;
}

/**
 * Context injected into every protected action
 */
interface ActionContext {
  user?: {
    id: string;
    email?: string | null;
    name?: string | null;
  };
}

function assertSerializable<TOutput>(output: TOutput, enabled?: boolean): TOutput {
  if (!enabled || process.env.NODE_ENV !== "development") {
    return output;
  }

  try {
    structuredClone(output);
    return output;
  } catch (error) {
    throw new InternalServerError("Server action output must be serializable", {
      originalError: error instanceof Error ? error.message : error,
    });
  }
}

function validateInput<TInput>(schema: z.Schema<TInput>, input: TInput): TInput {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new BadRequestError("Invalid input", { errors: result.error.flatten() });
  }

  return result.data;
}

function buildUser(session: Session | null): ActionContext["user"] {
  return session?.user ? {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
  } : undefined;
}

function ensureUser(user: ActionContext["user"]): Required<ActionContext>["user"] {
  if (!user?.id) {
    throw new UnauthorizedError();
  }

  return user;
}

function executeAction<TInput, TOutput>(
  input: TInput,
  schema: z.Schema<TInput>,
  handler: ActionHandler<TInput, TOutput>,
  options: ActionOptions,
  requireAuth: false
): Promise<TOutput>;

function executeAction<TInput, TOutput>(
  input: TInput,
  schema: z.Schema<TInput>,
  handler: (input: TInput, ctx: Required<ActionContext>) => Promise<TOutput>,
  options: ActionOptions,
  requireAuth: true
): Promise<TOutput>;

async function executeAction<TInput, TOutput>(
  input: TInput,
  schema: z.Schema<TInput>,
  handler: ActionHandler<TInput, TOutput> | ((input: TInput, ctx: Required<ActionContext>) => Promise<TOutput>),
  options: ActionOptions,
  requireAuth: boolean
): Promise<TOutput> {
  const data = validateInput(schema, input);
  const session: Session | null = options.auth === "none" ? null : await auth();
  const user = buildUser(session);
  const ctx = requireAuth ? { user: ensureUser(user) } : { user };
  const output = await handler(data, ctx as Required<ActionContext>);

  return assertSerializable(output, options.assertSerializable);
}

/**
 * Creates a safe server action with input validation and error handling
 *
 * @example
 * export const updateProfile = createAction(
 *   updateProfileSchema,
 *   async (data) => { ... }
 * );
 */
export function createAction<TInput, TOutput>(
  schema: z.Schema<TInput>,
  handler: ActionHandler<TInput, TOutput>,
  options: ActionOptions = {}
) {
  return async (input: TInput): Promise<TOutput> => {
    return withServerErrorHandler(async () => {
      return executeAction(input, schema, handler, options, false);
    });
  };
}

/**
 * Creates a protected server action that requires authentication
 *
 * @example
 * export const addPost = createProtectedAction(
 *   postSchema,
 *   async (data, { user }) => { ... } // user is guaranteed here
 * );
 */
export function createProtectedAction<TInput, TOutput>(
  schema: z.Schema<TInput>,
  handler: (input: TInput, ctx: Required<ActionContext>) => Promise<TOutput>,
  options: Pick<ActionOptions, "assertSerializable"> = {}
) {
  return async (input: TInput): Promise<TOutput> => {
    return withServerErrorHandler(async () => {
      return executeAction(input, schema, handler, options, true);
    });
  };
}

/**
 * Creates a safe server action that returns a result envelope instead of throwing
 */
export function createActionResult<TInput, TOutput>(
  schema: z.Schema<TInput>,
  handler: ActionHandler<TInput, TOutput>,
  options: ActionOptions = {}
) {
  return async (input: TInput): Promise<ActionResult<TOutput>> => {
    return withServerResultHandler(async () => {
      return executeAction(input, schema, handler, options, false);
    });
  };
}

/**
 * Creates a protected server action that returns a result envelope instead of throwing
 */
export function createProtectedActionResult<TInput, TOutput>(
  schema: z.Schema<TInput>,
  handler: (input: TInput, ctx: Required<ActionContext>) => Promise<TOutput>,
  options: Pick<ActionOptions, "assertSerializable"> = {}
) {
  return async (input: TInput): Promise<ActionResult<TOutput>> => {
    return withServerResultHandler(async () => {
      return executeAction(input, schema, handler, options, true);
    });
  };
}
