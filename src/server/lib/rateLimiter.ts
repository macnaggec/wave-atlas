import { TooManyRequestsError } from 'shared/errors';

// In-memory sliding-window rate limiter. Not suitable for multi-instance deployments.
export function createRateLimiter(options: {
  windowMs: number;
  max: number
}) {
  const store = new Map<string, number[]>();

  return function check(key: string): void {
    const now = Date.now();
    const windowStart = now - options.windowMs;
    const hits = (store.get(key) ?? []).filter((t) => t > windowStart);

    if (hits.length >= options.max) {
      throw new TooManyRequestsError('Rate limit exceeded');
    }

    hits.push(now);
    if (hits.length > 0) store.set(key, hits);
    else store.delete(key);
  };
}
