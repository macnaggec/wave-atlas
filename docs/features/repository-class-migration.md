# Repository Layer: Migration to Class-Based Architecture

## Status
Ready to implement. No production environment — development stage only.
Resolves backlog #39 (PrismaErrorMapper never called) and unblocks #38 (race-condition double fulfillment).

## Decision history
- #42 and #43 previously removed classes in favour of plain functions (simplicity trade-off)
- Decision reversed: class-based repos are more architecturally sound on the server (no tree-shaking concern, proper SRP/DIP/interface contracts)
- `withMappedErrors` helper was considered as an interim step but skipped — going straight to classes avoids doing the work twice

## Context

The current repository layer uses plain exported async functions (`createOrder`, `findMediaById`, etc.).
This works but has structural weaknesses:

- No central place for cross-cutting concerns (error mapping, logging, tracing)
- `PrismaErrorMapper` (`src/shared/errors/PrismaErrorMapper.ts`) is fully implemented but never called anywhere — Prisma P2002/P2025 bubble up as raw `INTERNAL_SERVER_ERROR`
- No interface contracts → impossible to mock at the type level in tests
- One dead partial attempt exists in `MediaRepository.ts`: `IMediaRepository` interface with only `findById`, and a `mediaRepository` plain object — must be removed during migration

This document describes a complete, incremental migration to class-based repositories with interface contracts.

---

## Goal

```
Plain functions                  Class-based with interface
─────────────────────────────    ──────────────────────────────────────────
export async function foo() {}   export class OrderRepository extends BaseRepository
                                   implements IOrderRepository {
No error mapping                   async createOrder() { return this.run(() => ...); }
                                 }
Module-level vi.mock()           vi.spyOn(orderRepository, 'createOrder')
```

---

## Target Architecture

```
BaseRepository
  └─ run<T>(fn) → catches Prisma errors → maps to HttpError

OrderRepository  extends BaseRepository  implements IOrderRepository
MediaRepository  extends BaseRepository  implements IMediaRepository
SpotRepository   extends BaseRepository  implements ISpotRepository
UserRepository   extends BaseRepository  implements IUserRepository

Each repo exports a singleton:
  export const orderRepository = new OrderRepository();
```

Services and routes import the singleton, not individual functions.
Tests spy on the singleton or mock the module returning a matching shape.

---

## Phase 1 — Create `BaseRepository`

**File:** `src/server/repositories/BaseRepository.ts` (NEW)

```ts
import { mapPrismaError } from 'shared/errors/PrismaErrorMapper';

export abstract class BaseRepository {
  protected async run<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      throw mapPrismaError(err);
    }
  }
}
```

`mapPrismaError` is imported from `shared/errors/PrismaErrorMapper.ts` which already maps:
- `P2002` → `ConflictError`
- `P2025` → `NotFoundError`
- `P2003` → `BadRequestError` (foreign key violation)
- `P2011` → `BadRequestError` (required field missing)
- `P2000` → `BadRequestError` (value too long)

**Rule:** Wrap ALL DB calls in `this.run()` — both reads and writes. No judgment call needed, consistent, and safe (reads that return `null` don't throw P2025 anyway).

**Acceptance:** Unit test — pass a mock `PrismaClientKnownRequestError` with code `P2002` through `run()`, assert it throws `ConflictError`.

---

## Phase 2 — Migrate Repositories (one at a time)

Order: `UserRepository` (1 function) → `MediaRepository` → `SpotRepository` → `OrderRepository` (most complex, closes #38).

### Pattern per repository

1. Add `import { prisma } from 'server/db';` if not already there.
2. Define `I{Name}Repository` interface (exported) above the class.
3. `class {Name}Repository extends BaseRepository implements I{Name}Repository`
4. Every method body: `return this.run(() => prisma.xxx...)`.
5. `mapPrismaToXxx` mapper functions stay as plain exported functions — they are pure data transformers, not DB operations.
6. Export a singleton at the bottom: `export const {name}Repository = new {Name}Repository();`
7. Remove old plain function exports (or keep temporarily as re-exports during transition if needed).

---

### 2a — `UserRepository`

**File:** `src/server/repositories/UserRepository.ts`

Current plain functions:
- `anonymizeAndDelete(userId: string): Promise<void>` — uses `prisma.$transaction([...])`

```ts
import { prisma } from 'server/db';
import { BaseRepository } from './BaseRepository';

export interface IUserRepository {
  anonymizeAndDelete(userId: string): Promise<void>;
}

export class UserRepository extends BaseRepository implements IUserRepository {
  anonymizeAndDelete(userId: string): Promise<void> {
    return this.run(() =>
      prisma.$transaction([
        prisma.spot.updateMany({ where: { creatorId: userId }, data: { creatorId: null } }),
        prisma.user.update({
          where: { id: userId },
          data: {
            name: 'Deleted User',
            email: `deleted_${userId}@deleted.invalid`,
            image: null,
            password: null,
            deletedAt: new Date(),
          },
        }),
        prisma.session.deleteMany({ where: { userId } }),
        prisma.account.deleteMany({ where: { userId } }),
      ])
    );
  }
}

export const userRepository = new UserRepository();
```

**Consumer update:**
- `src/server/routes/users.ts` line 3: `import { anonymizeAndDelete } from 'server/repositories/UserRepository'`
  → `import { userRepository } from 'server/repositories/UserRepository'`
  → `deleteAccount: ... userRepository.anonymizeAndDelete(ctx.user.id)`

---

### 2b — `MediaRepository`

**File:** `src/server/repositories/MediaRepository.ts`

Current plain functions (complete list):
- `createMedia(data)` — `prisma.mediaItem.create`
- `findMediaById(id)` — `prisma.mediaItem.findUnique`
- `updateMedia(id, data)` — `prisma.mediaItem.update`
- `softDeleteMedia(id)` — `prisma.mediaItem.update` (sets status DELETED, deletedAt)
- `hardDeleteMedia(id)` — `prisma.mediaItem.delete`
- `findMediaByIds(ids)` — `prisma.mediaItem.findMany` + `price.toNumber()` mapping
- `findMediaByIdsForFulfillment(ids)` — `prisma.mediaItem.findMany` (different select)
- `findPublishedByPhotographer(photographerId)` — `prisma.mediaItem.findMany`
- `countDraftsBySpot(photographerId)` — `prisma.mediaItem.groupBy` + `prisma.spot.findMany`
- `findDraftsBySpot(spotId, photographerId)` — `prisma.mediaItem.findMany`
- `mapPrismaToMediaItem(prismaMedia)` — **pure mapper, stays as plain function**

**Dead code to remove:**
```ts
// DELETE these — they exist in the current file and are replaced by the class:
export interface IMediaRepository { findById(id: string): Promise<PrismaMediaItem | null>; }
export const mediaRepository: IMediaRepository = { findById: findMediaById };
```

Interface (use exact return types from current implementations):
```ts
export interface IMediaRepository {
  createMedia(data: CreateMediaData): Promise<PrismaMediaItem>;
  findById(id: string): Promise<PrismaMediaItem | null>;
  updateMedia(id: string, data: UpdateMediaData): Promise<PrismaMediaItem>;
  softDelete(id: string): Promise<PrismaMediaItem>;
  hardDelete(id: string): Promise<void>;
  findByIds(ids: string[]): Promise<{ id: string; status: string; price: number; photographerId: string }[]>;
  findByIdsForFulfillment(ids: string[]): Promise<MediaFulfillmentItem[]>;
  findPublishedByPhotographer(photographerId: string): Promise<...>; // infer from current return
  countDraftsBySpot(photographerId: string): Promise<{ spotId: string; spotName: string; count: number }[]>;
  findDraftsBySpot(spotId: string, photographerId: string): Promise<PrismaMediaItem[]>;
}
```

**Consumer updates:**

| File | Old import | New call |
|---|---|---|
| `src/server/routes/media.ts` | `createMedia, updateMedia, softDeleteMedia, hardDeleteMedia, mapPrismaToMediaItem` | `mediaRepository.createMedia`, etc. + `mapPrismaToMediaItem` stays as plain import |
| `src/server/routes/spots.ts` | `mapPrismaToMediaItem, findDraftsBySpot` | `mediaRepository.findDraftsBySpot`, `mapPrismaToMediaItem` stays |
| `src/server/routes/users.ts` | `findPublishedByPhotographer, countDraftsBySpot` | `mediaRepository.findPublishedByPhotographer`, etc. |
| `src/server/lib/mediaAuth.ts` | `findMediaById` | `mediaRepository.findById` |
| `src/server/services/CheckoutService.ts` | `findMediaByIds` | `mediaRepository.findByIds` |
| `src/server/services/PurchaseFulfillmentService.ts` | `findMediaByIdsForFulfillment` | `mediaRepository.findByIdsForFulfillment` |

---

### 2c — `SpotRepository`

**File:** `src/server/repositories/SpotRepository.ts`

Current plain functions (complete list):
- `findSpotList(filter)` — `prisma.spot.findMany` + `mapPrismaToSpot`
- `findSpotsInBoundingBox(bbox)` — private helper, becomes `private` method on class
- `findSpotsNearby(lat, lng, radiusM)` — calls `findSpotsInBoundingBox` + haversine filter
- `findSpotById(id)` — `prisma.spot.findUnique`
- `createSpot(data)` — `prisma.spot.create` + `mapPrismaToSpot`
- `pushSpotAlias(id, alias)` — `prisma.spot.update`
- `findSpotDetails(id)` — `prisma.spot.findUnique` with `include`
- `findSpotCard(id)` — `prisma.spot.findUnique` with `select`
- `mapPrismaToSpot(spot)` — **pure mapper, stays as plain function**

Existing exported interfaces `SpotSearchFilter` and `SpotCreateInput` — keep as-is.

```ts
export interface ISpotRepository {
  findSpotList(filter: SpotSearchFilter): Promise<Spot[]>;
  findSpotsNearby(lat: number, lng: number, radiusM: number): Promise<Spot[]>;
  findSpotById(id: string): Promise<PrismaSpot | null>;
  createSpot(data: SpotCreateInput): Promise<Spot>;
  pushSpotAlias(id: string, alias: string): Promise<void>;
  findSpotDetails(id: string): Promise<SpotDetails | null>;
  findSpotCard(id: string): Promise<SpotCard | null>;
}
```

**Consumer update:**
- `src/server/routes/spots.ts` imports `findSpotList, findSpotsNearby, findSpotById, createSpot, pushSpotAlias, findSpotDetails, findSpotCard`
  → replace all with `spotRepository.xxx`

---

### 2d — `OrderRepository`

**File:** `src/server/repositories/OrderRepository.ts`

Current plain functions (complete list):
- `createOrder(data)` — `prisma.order.create`
- `findOrderById(id)` — `prisma.order.findUnique` with `include: { items: true }`
- `findOrderByExternalId(externalOrderId)` — `prisma.order.findUnique`
- `findPurchasesByBuyer(buyerId)` — `prisma.purchase.findMany`
- `findPurchaseByBuyerAndMedia(buyerId, mediaItemId)` — `prisma.purchase.findFirst`
- `findPurchasedItemIds(buyerId, itemIds)` — `prisma.purchase.findMany`
- `markOrderFailed(orderId)` — `prisma.order.update`
- `fulfill(orderId, externalOrderId, purchases, earningsMap)` — `prisma.$transaction` ← **critical for #38**

`fulfill` is the key method: wrapping it in `this.run()` means when the `@@unique([externalOrderId])` constraint (#38) fires, `P2002` propagates as `ConflictError` which `PurchaseFulfillmentService` can catch as idempotent success.

```ts
export interface IOrderRepository {
  createOrder(data: CreateOrderData): Promise<OrderWithItems>;
  findOrderById(id: string): Promise<OrderWithItems | null>;
  findOrderByExternalId(externalOrderId: string): Promise<PrismaOrder | null>;
  findPurchasesByBuyer(buyerId: string): Promise<PurchaseWithMedia[]>;
  findPurchaseByBuyerAndMedia(buyerId: string, mediaItemId: string): Promise<PurchaseWithMedia | null>;
  findPurchasedItemIds(buyerId: string, itemIds: string[]): Promise<string[]>;
  markOrderFailed(orderId: string): Promise<PrismaOrder>;
  fulfill(orderId: string, externalOrderId: string, purchases: FulfillPurchaseData[], earningsMap: Map<string, number>): Promise<void>;
}
```

**Consumer updates:**

| File | Old import | New call |
|---|---|---|
| `src/server/services/CheckoutService.ts` | `createOrder, findPurchasesByBuyer, markOrderFailed, findPurchaseByBuyerAndMedia, findPurchasedItemIds` | `orderRepository.xxx` |
| `src/server/services/PurchaseFulfillmentService.ts` | `findOrderByExternalId, findOrderById, fulfill` | `orderRepository.xxx` |

---

## Phase 3 — Update Consumers

All consumer updates are listed per-repo in Phase 2 above. Summary table:

| File | Repos imported |
|---|---|
| `src/server/routes/users.ts` | `UserRepository`, `MediaRepository` |
| `src/server/routes/media.ts` | `MediaRepository` |
| `src/server/routes/spots.ts` | `SpotRepository`, `MediaRepository` |
| `src/server/lib/mediaAuth.ts` | `MediaRepository` |
| `src/server/services/CheckoutService.ts` | `OrderRepository`, `MediaRepository` |
| `src/server/services/PurchaseFulfillmentService.ts` | `OrderRepository`, `MediaRepository` |

`mapPrismaToMediaItem` and `mapPrismaToSpot` remain plain exported functions — they are pure data transforms with no DB involvement, no change needed.

---

## Phase 4 — Update Tests

**Known test files that mock repositories:**
- `src/server/services/PurchaseFulfillmentService.test.ts`

Current pattern (module mock as function map):
```ts
vi.mock('server/repositories/OrderRepository', () => ({
  findOrderByExternalId: vi.fn(),
  findOrderById: vi.fn(),
  fulfill: vi.fn(),
}));
vi.mock('server/repositories/MediaRepository', () => ({
  findMediaByIdsForFulfillment: vi.fn(),
}));
const { findOrderByExternalId, findOrderById, fulfill } = vi.mocked(OrderRepository);
const { findMediaByIdsForFulfillment } = vi.mocked(MediaRepository);
```

After migration — mock the module returning the singleton shape:
```ts
vi.mock('server/repositories/OrderRepository', () => ({
  orderRepository: {
    findOrderByExternalId: vi.fn(),
    findOrderById: vi.fn(),
    fulfill: vi.fn(),
  },
}));
vi.mock('server/repositories/MediaRepository', () => ({
  mediaRepository: {
    findByIdsForFulfillment: vi.fn(),
  },
}));
import { orderRepository } from 'server/repositories/OrderRepository';
import { mediaRepository } from 'server/repositories/MediaRepository';
// Use vi.mocked(orderRepository).findOrderByExternalId.mockResolvedValue(...)
```

Note: `PurchaseFulfillmentService.ts` currently imports `findOrderByExternalId`, `findOrderById`, `fulfill` as named functions. After migration it imports `orderRepository` and calls methods — the test mock shape must match.

Before starting, run:
```sh
grep -r "repositories/OrderRepository\|repositories/MediaRepository\|repositories/SpotRepository\|repositories/UserRepository" src/ --include="*.test.ts"
```
to confirm the full list of test files to update.

---

## Phase 5 — Cleanup

- Confirm no plain function exports remain in any repository file (only class, interface, singleton, types, and pure mappers)
- Confirm `mapPrismaError` has exactly one callsite: `BaseRepository.ts`
- Remove dead `IMediaRepository` interface + `mediaRepository` plain object from `MediaRepository.ts` (done during Phase 2b)
- Run full test suite: `npm test`
- Run TypeScript check: `npx tsc --noEmit`

---

## Sequence Summary

```
Phase 1   BaseRepository.ts (NEW)          ~20 min    No consumers change
Phase 2a  UserRepository                   ~15 min    1 consumer: users.ts
Phase 2b  MediaRepository                  ~30 min    5 consumers
Phase 2c  SpotRepository                   ~25 min    1 consumer: spots.ts
Phase 2d  OrderRepository                  ~30 min    2 consumers
Phase 4   Update tests                     ~20 min    PurchaseFulfillmentService.test.ts + any others
Phase 5   Cleanup + tsc + tests            ~15 min
──────────────────────────────────────────────────────
Total                                      ~2.5 h
```
