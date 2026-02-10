'use client';

import { useEffect } from 'react';
import { MantineProvider } from '@mantine/core'; // Add this import
import { ErrorFallback } from 'shared/ui/ErrorFallback';
import { logger } from 'shared/lib/logger';
import { theme } from './theme'; // Import theme from same directory

/**
 * Global error boundary - catches errors in root layout
 * This is a last resort fallback
 *
 * IMPORTANT: This file must:
 * 1. Be a Client Component ('use client')
 * 2. Include <html> and <body> tags (replaces root layout on error)
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error('Global error caught', {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    });

    // TODO: Send to error tracking service
  }, [error]);

  return (
    <html>
      <body>
        <MantineProvider> {/* Wrap in MantineProvider */}
          <ErrorFallback error={error} reset={reset} showHomeButton={false} />
        </MantineProvider>
      </body>
    </html>
  );
}
