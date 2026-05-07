# Architecture Notes

## Rate Limiting

`server/lib/rateLimiter.ts` implements a sliding-window rate limiter using a per-process in-memory `Map`.

**Limitations:**
- Resets on server restart — burst traffic immediately after a restart is not throttled.
- Does not synchronise across multiple server instances — in a horizontally scaled deployment each instance maintains its own counters, effectively multiplying the allowed rate by the number of instances.

**Scaling path:** Replace the in-memory `Map` with a Redis-backed store (e.g. `ioredis` + a Lua sliding-window script, or the `rate-limiter-flexible` package with a Redis driver). The external `check(key)` API of `createRateLimiter` can remain unchanged; only the store implementation needs to swap.
