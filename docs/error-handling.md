# Error Handling System

> Sequence diagrams of the main error flows. For full reference (all throw sites, design decisions, rules) see the sections below the diagrams.

---

## Error Class Hierarchy

```
Error (JS built-in)
└── HttpError              statusCode + code + details?
    ├── BadRequestError          400
    ├── UnauthorizedError        401
    ├── ForbiddenError           403
    ├── NotFoundError            404
    ├── ConflictError            409
    ├── UnprocessableEntityError 422
    ├── InternalServerError      500
    ├── BadGatewayError          502
    └── ServiceUnavailableError  503
```

**Rule:** Services and routes always throw `HttpError` subclasses. One place (`errorFormatter` in `trpc.ts`) translates them to tRPC codes. Nothing else.

---

## Diagram 1 — Normal domain error (the common path)

```
Client          tRPC Handler       Route         Service            DB
  │                  │               │               │              │
  │──mutate()───────►│               │               │              │
  │                  │──────────────►│               │              │
  │                  │               │──────────────►│              │
  │                  │               │               │─────query───►│
  │                  │               │               │◄────null─────│
  │                  │               │               │              │
  │                  │               │    throw ForbiddenError(403) │
  │                  │               │◄──────────────│              │
  │                  │◄──────────────│               │              │
  │                  │               │               │              │
  │             errorFormatter()     │               │              │
  │             isHttpError → true   │               │              │
  │             403 → 'FORBIDDEN'    │               │              │
  │                  │               │               │              │
  │◄─────────────────│               │               │              │
  │  { error: {      │               │               │              │
  │    message: "You have not purchased this item"   │              │
  │    data: { code: "FORBIDDEN" }                   │              │
  │  }}              │               │               │              │
  │                  │               │               │              │
mutation.isError = true
mutation.error.message = "You have not purchased this item"
```

---

## Diagram 2 — Auth guard (not logged in)

```
Client          protectedProcedure    Route         Service
  │                    │                │               │
  │──mutate()─────────►│                │               │
  │                    │                │               │
  │               ctx.user === null     │               │
  │               throw TRPCError('UNAUTHORIZED')       │
  │                    │                │               │
  │             errorFormatter()        │               │
  │             isHttpError → false     │               │
  │             passthrough (no change) │               │
  │                    │                │               │
  │◄───────────────────│                │               │
  │  { error: { data: { code: "UNAUTHORIZED" } }}       │
  │                    │                │               │
mutation.error.data.code = "UNAUTHORIZED"  → show auth modal
```

> Note: `protectedProcedure` throws `TRPCError` directly (not `HttpError`) because it is transport-level middleware, not business logic.

---

## Diagram 3 — Payment webhook verification

```
Internet/Attacker    Webhook Handler    PaymentAdapter    FulfillmentService    DB
       │                   │                   │                  │              │
       │──POST/webhook────►│                   │                  │              │
       │                   │──verifyWebhook()─►│                  │              │
       │                   │                   │                  │              │
       │                   │           parse JSON body            │              │
       │                   │           compute HMAC signature     │              │
       │                   │           compare signatures         │              │
       │                   │                   │                  │              │
       │                   │      [if mismatch or parse fails]    │              │
       │                   │◄────return false──│                  │              │
       │◄──401 rejected────│                   │                  │              │
       │                   │                   │                  │              │
       │                   │              [if match]              │              │
       │                   │◄────return true───│                  │              │
       │                   │                   │                  │              │
       │                   │───────────────────────fulfillOrder()►│              │
       │                   │                   │   findByExternalOrderId()──────►│
       │                   │                   │                  │◄─────────────│
       │                   │                   │              [if found]         │
       │                   │                   │              return (no-op) ✓   │
       │                   │                   │              [if not found]     │
       │                   │                   │   fetch order + media items ───►│
       │                   │                   │                  │◄─────────────│
       │                   │                   │   generate preview URL ────────►│ Cloudinary
       │                   │                   │                  │◄─────────────│ (or null)
       │                   │                   │   compute fee split (80/20)     │
       │                   │                   │   write Purchase rows ─────────►│
       │                   │                   │   write PhotographerEarnings ──►│
       │                   │                   │   set order = FULFILLED ───────►│
       │◄──200 ok──────────│                   │                  │              │
```

> Errors inside `verifyWebhook` are caught internally and converted to `false` — they never propagate. This prevents malformed webhook spam from crashing the handler.

---

## Diagram 4 — Prisma error (currently unwired ⚠️)

```
Service            PrismaErrorMapper        errorFormatter      Client        DB
   │                      │                       │               │            │
   │──DB write────────────────────────────────────────────────────────────────►│
   │                      │                       │               │            │
   │◄──────────────────────────────────────────────────────────────── P2002 ───│
   │                      │                       │               │            │
   │──mapPrismaError()───►│                       │               │            │
   │                  P2002 → ConflictError(409)  │               │            │
   │◄─────────────────────│                       │               │            │
   │                      │                       │               │            │
   │──throw ConflictError────────────────────────►│               │            │
   │                      │                  isHttpError → true   │            │
   │                      │                  409 → 'CONFLICT'     │            │
   │                      │                       │──────────────►│            │
   │                      │                       │         code: "CONFLICT"   │
```

> ⚠️ `PrismaErrorMapper` is defined but not yet called anywhere. Prisma errors currently leak as `INTERNAL_SERVER_ERROR`.

---

## Quick Reference

### statusCode → tRPC code mapping

```
401  →  UNAUTHORIZED
403  →  FORBIDDEN
404  →  NOT_FOUND
409  →  CONFLICT
4xx  →  BAD_REQUEST
5xx  →  INTERNAL_SERVER_ERROR
```

### Rules

| Rule | Why |
|------|-----|
| Throw `HttpError` subclasses, never plain `Error` | Plain errors lose their message — client gets generic `INTERNAL_SERVER_ERROR` |
| Services never throw `TRPCError` | Keeps services transport-agnostic |
| One translation point only (`errorFormatter`) | A second translator creates drift and inconsistency |
| Swallowed errors must log | Silent `catch {}` hides bugs in production |
| Payment adapters return `false`, never throw | Prevents webhook spam from crashing the handler |
