'use client';

import { useEffect } from 'react';
import { ErrorFallback } from 'shared/ui/ErrorFallback';
import { logger } from 'shared/lib/logger';

/**
 * Error boundary for all routes under (main) layout
 * Catches errors in:
 * - Page components
 * - Server components that throw
 * - Client components that crash during render
 *
 * This file must be a Client Component ('use client')
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to console and tracking service
    logger.error('Route error caught by error boundary', {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    });

    // TODO: Send to error tracking service (Sentry, LogRocket, etc.)
    // Example: Sentry.captureException(error);
  }, [error]);

  return <ErrorFallback error={error} reset={reset} />;
}
