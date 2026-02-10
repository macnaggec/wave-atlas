import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { HttpError, InternalServerError, isHttpError } from 'shared/errors';
import { mapPrismaError } from 'shared/errors/PrismaErrorMapper';
import { logger } from 'shared/lib/logger';

/**
 * Converts any error to an HttpError
 */
function normalizeError(error: unknown): HttpError {
  // Already an HttpError - return as is
  if (isHttpError(error)) {
    return error;
  }

  // Prisma error - map to HttpError
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const mappedError = mapPrismaError(error);
    return isHttpError(mappedError)
      ? mappedError
      : new InternalServerError(mappedError.message);
  }

  // Generic error - wrap in InternalServerError
  if (error instanceof Error) {
    return new InternalServerError(
      process.env.NODE_ENV === 'development'
        ? error.message
        : 'An unexpected error occurred',
      { originalError: error.message, stack: error.stack }
    );
  }

  // Unknown error type
  return new InternalServerError('An unexpected error occurred', { error });
}

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string; details?: unknown };

/**
 * Transforms errors into standardized NextResponse objects
 */
export function handleApiError(error: unknown): NextResponse {
  const httpError = normalizeError(error);

  // Log based on severity
  if (httpError.statusCode >= 500) {
    logger.error('Server error in API route', {
      error: httpError.message,
      code: httpError.code,
      statusCode: httpError.statusCode,
      details: httpError.details,
      stack: httpError.stack,
    });
  } else {
    logger.warn('Client error in API route', {
      error: httpError.message,
      code: httpError.code,
      statusCode: httpError.statusCode,
    });
  }

  // Return consistent error response
  return NextResponse.json(
    httpError.toJSON(),
    { status: httpError.statusCode }
  );
}

/**
 * Higher-order function that wraps API route handlers with error handling
 */
export function withErrorHandler<T extends unknown[]>(
  handler: (...args: T) => Promise<NextResponse>
) {
  return async (...args: T): Promise<NextResponse> => {
    try {
      return await handler(...args);
    } catch (error) {
      return handleApiError(error);
    }
  };
}

/**
 * Async wrapper for server actions and server components
 * Throws the error for Next.js error boundaries to catch
 */
export async function withServerErrorHandler<T>(
  fn: () => Promise<T>
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    const httpError = normalizeError(error);

    logger.error('Server component/action error', {
      error: httpError.message,
      code: httpError.code,
      statusCode: httpError.statusCode,
      stack: httpError.stack,
    });

    // Re-throw for error.tsx to catch
    throw httpError;
  }
}

/**
 * Async wrapper for server actions that return a result envelope
 * Does not throw; instead returns a standardized ActionResult
 */
export async function withServerResultHandler<T>(
  fn: () => Promise<T>
): Promise<ActionResult<T>> {
  try {
    return { success: true, data: await fn() };
  } catch (error) {
    const httpError = normalizeError(error);

    if (httpError.statusCode >= 500) {
      logger.error('Server component/action error', {
        error: httpError.message,
        code: httpError.code,
        statusCode: httpError.statusCode,
        details: httpError.details,
        stack: httpError.stack,
      });
    } else {
      logger.warn('Client error in server action', {
        error: httpError.message,
        code: httpError.code,
        statusCode: httpError.statusCode,
        details: httpError.details,
      });
    }

    return {
      success: false,
      error: httpError.message,
      code: httpError.code,
      details: httpError.details,
    };
  }
}
