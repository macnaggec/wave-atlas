# Backlog

## Legend

| Symbol | Priority | Meaning |
|--------|----------|---------|
| ✅ | — | Completed |
| 🔴 **P0** | Critical | Security vulnerability, data-loss risk, or broken core flow |
| 🟠 **P1** | High | Significant bug or important correctness issue |
| 🟡 **P2** | Medium | UX improvement, performance, or non-blocking feature |
| 🟢 **P3** | Low | Nice-to-have or post-MVP |

---

## Items

1. ✅ ~~Spread `client/views` and `src/views` into proper FSD layer directories~~

2. ✅ ~~Deleting a draft from the Upload tab does not refresh the indicator on My Collection → My Uploads~~

3. ✅ ~~Upload progress plate on main page overlaps and replaces the user menu control~~

4. 🟠 **P1** `[bug]` Opening any drawer or menu should close all others
   - Currently the spot preview card stays open when the user menu or My Collection drawer opens

5. 🟠 **P1** `[bug]` Block the Publish button until both price and date are set

6. ✅ ~~When drafts are selected, Publish button should say "Publish {count}" instead of publishing all~~

7. 🟠 **P1** `[bug]` Side panel re-opens on every browser window focus when it was already open; slide-in animation on standalone page load looks broken

8. 🟡 **P2** `[ux]` Spot URLs use raw IDs — should be human-readable slugs
   - **Recommended**: TanStack Router `loader` on `$spotName` route resolves slug → spot entity before component renders
   - `GlobeMapComponent` already accepts `initialSpotId` — routing layer owns the resolution, widget stays routing-agnostic
   - **Option A**: ID-embedded slug (e.g. `/bali-soul--cm9x2k3f4`) — zero-lookup simplicity
   - **Option C**: server loader — clean URLs, requires DB lookup on every navigation

9. 🟢 **P3** `[feature]` *(post-MVP)* "Suggest a better name" — let users propose a new primary name for a spot from the spot panel
   - If accepted: replaces `name`, old name moves to `aliases` so existing searches still resolve

10. 🟡 **P2** `[bug]` Preview card photos stack vertically instead of showing a carousel
    - Decide on source media: last uploaded photo vs. curated admin picks

11. 🔴 **P0** `[security]` Restrict Mapbox public token to production/staging domains in the Mapbox dashboard to prevent quota abuse
    - Dashboard: https://account.mapbox.com/access-tokens/

12. ✅ ~~Audit `useTRPC()` data-fetching patterns and verify all error paths use `shared/errors` utilities (`getErrorMessage`, `ClientErrors`, etc.) consistently~~

13. 🟡 **P2** `[ux]` Add Spot panel is too large — it hides the map; make it more compact

14. 🟡 **P2** `[ux]` Search results: each result item takes too much vertical space

15. ✅ ~~`spots.ts` tRPC route called Prisma directly — extended repository/service pattern to spots (`SpotRepository`)~~

16. 🟢 **P3** `[feature]` Support uploading media from Google Drive
    - **Decision**: do NOT use Cloudinary Upload Widget — it imports Drive files immediately, consuming quota before publish
    - **Architecture**: Google Picker API (client) + server-side Cloudinary URL upload at publish time
      1. User authorises Google Picker (OAuth) — no Cloudinary involved at this step
      2. Picker returns a Drive URL/ID — stored in DB as `media_items.drive_url` with status `DRIVE_PENDING`
      3. At publish: server calls Cloudinary Upload API with `file: driveUrl` — quota consumed only then
    - Keep current XHR pipeline for direct uploads (progress tracking, per-file abort, full UI control)
    - Apply file size/type validation from #36 at the Cloudinary URL-fetch step

17. 🔴 **P0** `[error-handling]` Fix silent swallowing of errors across the codebase

18. 🟠 **P1** `[feature]` Design and implement payment system UX

19. 🟡 **P2** `[feature]` Add per-photographer upload limits with a visual usage indicator

20. 🟡 **P2** `[perf]` Add virtualised lists for all galleries (see also #34)

21. 🟠 **P1** `[bug]` Free photos show watermarks in the lightbox preview — they should not

22. 🟡 **P2** `[ux]` Design UX for displaying original file resolution and metadata

23. 🟠 **P1** `[bug]` Two related issues:
    - Edit price control must enforce a minimum of $3
    - Close the preview card when any drawer opens (not only when dismissed from the card itself — see also #4)

24. 🟡 **P2** `[feature]` Add "Buy Now" that bypasses the cart

25. 🟢 **P3** `[feature]` Decide how video media is handled end-to-end

26. ✅ ~~Users can add their own published media to the cart~~

27. 🟠 **P1** `[error-handling]` Audit server service error handling — apply the same abstract error pattern used in `CheckoutService` consistently across all services

28. ✅ ~~`media.signCloudinary` — no folder ownership check; any authenticated user can obtain a valid upload signature for another user's spot folder~~
    - Input changed from `folder?: string` to `spotId: uuid`; server queries `spot.creatorId`, throws `ForbiddenError` if mismatch
    - File: `src/server/routes/media.ts` → `signCloudinary` procedure

29. ✅ ~~`media.create` — `thumbnailUrl` and `lightboxUrl` accept any URL, allowing external URL injection~~
    - Added `.refine()` on both fields requiring `https://res.cloudinary.com/{VITE_CLOUDINARY_CLOUD_NAME}/` prefix
    - File: `src/server/routes/media.ts` → `create` input schema

30. 🟡 **P2** `[ux]` Owner's upload gallery shows watermarked lightbox after page refresh
    - During active session: `previewUrl` is a local blob URL (no watermark) ✓
    - After refresh: drafts fall back to `draft.lightboxUrl` which is the watermarked public variant ✗
    - Fix: add a third eager transform `t_wave_atlas_lightbox_owner` (800px, no watermark, authenticated delivery); store in a new `ownerLightboxUrl` DB column
    - Requires: new Cloudinary named transform, Prisma migration, updated `MediaRepository.create`, updated `UploadPipeline.saveToDatabase`

31. 🟡 **P2** `[perf]` `media.updateBatch` issues 2 DB reads per item — collapse to 1
    - `ensureCanModify()` → `findById` (read #1); then route → `findById` again for status check (read #2)
    - 20-item batch = 40 DB round-trips instead of 20
    - Fix: extend `ensureCanModify()` to also return status, or add `ensureCanModifyDraft(userId, mediaId)` checking ownership + `DRAFT` status in one query
    - Files: `MediaAuthorizationService.ts`, `src/server/routes/media.ts` → `updateBatch`

32. 🟡 **P2** `[refactor]` Rename `photographerId` → `ownerId` / `authorId` / `creatorId` across the codebase

33. ✅ ~~Add structured server-side logger — replace all raw `console.*` calls~~
    - `src/shared/lib/logger.ts` created with class-based Logger: env-aware pretty-print (dev) vs JSON (prod)
    - `CloudinaryService.tryGeneratePermanentPreviewUrl` migrated to `logger.warn`
    - Webhook handler uses `logger.error`
    - Remaining: one raw `console.log` in `src/server/index.ts` startup message (non-sensitive, low priority)

34. 🟡 **P2** `[perf]` Gallery infinite scroll + virtualised list
    - Spot galleries (GlobeScene, SpotPanel) load all media upfront — will degrade as data grows
    - **Server**: add `cursor`/`limit` to `spots.details` or a new `media.listBySpot` tRPC procedure (Prisma cursor pagination)
    - **Client**: replace `useQuery` → `useInfiniteQuery`; `getNextPageParam` reads last item id as cursor
    - **Virtualise**: use `@tanstack/react-virtual` (`useVirtualizer`) — only visible rows rendered in DOM
    - Scope excludes `_drawer.me.purchases.tsx` — 50-item cap is sufficient for purchases
    - Files: `views/SpotPanel`, `views/GlobeScene`, relevant tRPC routes

35. 🟢 **P3** `[perf]` Prefetch lightbox image on card hover in purchases gallery
    - Currently the full-res Cloudinary URL loads only when the modal opens → 1–3 s blank modal on slow connections
    - Fix: `queryClient.prefetchQuery` with an `Image` object `onload` promise; browser caches before modal opens
    - File: `src/app/routes/_drawer.me.purchases.tsx` — add `onMouseEnter` to each `<Card>`

36. ✅ ~~Upload pipeline missing validation guards~~
    1. ✅ ~~**Folder ownership**: verify the target spot belongs to the current user before signing (see #28)~~
    2. ✅ ~~**File type whitelist**: `resource_type` in `mediaCloudinaryResultSchema` changed from `z.string()` to `z.enum(['image', 'video'])`~~
    3. ✅ ~~**File size limit**: guard added at top of `uploadToCloudinary` in `cloudinaryTransport.ts`; rejects with `FILE_TOO_LARGE` before XHR starts; uses `MEDIA_UPLOAD_LIMITS` constants~~
    4. ✅ ~~**Rate limiting**: `createRateLimiter` utility in `src/server/lib/rateLimiter.ts`; `signCloudinary` capped at 10/user/min via tRPC `.use()` middleware~~

37. ✅ ~~Webhook endpoint rate limiting — replay-flood DoS~~
    - `webhookLimiter` (20 req/IP/min) added to `/api/webhook/cryptocloud` in `src/server/index.ts`
    - Uses same `createRateLimiter` utility as #36.4
    - IP extracted from `x-forwarded-for` / `cf-connecting-ip` headers

38. ✅ ~~Webhook fulfillment: non-atomic idempotency check — vulnerable to race-condition double fulfillment~~
    - `@@unique` on `externalOrderId` was already in the schema
    - `PurchaseFulfillmentService.fulfillOrder` now catches `ConflictError` (P2002) as idempotent success

39. ✅ ~~Wire `PrismaErrorMapper` into all repositories~~
    - All repositories (`Media`, `Order`, `Purchase`, `Spot`, `User`) already use `runQuery` from `BaseRepository`, which calls `mapPrismaError` in its catch — P2002/P2025 are fully mapped

40. ✅ ~~Payment adapters throw plain `new Error()` — internal provider details may leak to the client~~
    - `createCheckoutSession` HTTP error + unexpected response: now `logger.error(...)` + `throw new BadGatewayError('Payment provider error')`
    - `parseWebhookEvent` non-success status: no longer throws — returns `{ type: 'order.ignored' }` (safe, webhook handler already gates on `order.completed`)
    - `PaymentWebhookEvent` type extended to discriminated union `'order.completed' | 'order.ignored'`
    - File: `src/server/lib/payment/CryptoCloudAdapter.ts`, `src/server/lib/payment/PaymentAdapter.ts`

41. ✅ ~~Webhook handler has no try/catch around `handleEvent` — uncontrolled 500 exposes stack traces and triggers dangerous provider retries on partially-written fulfillments~~
    - Wrapped `fulfillOrder` in try/catch; logs via `logger.error`; returns controlled `{ error: 'Fulfillment error' }` with status 500

42. ✅ ~~Flatten `SpotRepository.ts` — remove `ISpotRepository` interface and `PrismaSpotRepository` class; replace with plain exported async functions~~

43. ✅ ~~Flatten `OrderRepository.ts` — remove `IOrderRepository`, `PrismaOrderRepository`, and `orderRepository` singleton; keep named exports~~

44. ✅ **P1** `[server]` `PurchaseFulfillmentService.ts` bypasses the repository layer — calls `prisma.mediaItem.findMany` and `prisma.$transaction` directly
    - Discovered during `users.ts` audit (April 2026)
    - Fix: add `MediaRepository.findByIds()`; verify `$transaction` block is fully delegated to `OrderRepository.fulfill`

45. ✅ ~~`spots.ts` tRPC route calls `prisma.mediaItem.findMany` directly (line ~131) — should go through `MediaRepository`~~
    - Added `findDraftsBySpot(spotId, photographerId)` to `MediaRepository`; `spots.ts` now delegates to it and no longer imports `prisma` directly

46. ✅ ~~`CheckoutService.ts` leaks `Prisma.Decimal` above the repository boundary~~

47. ✅ **P2** `[refactor]` `MediaAuthorizationService.ts` uses a class + interface pattern inconsistent with the rest of the services layer
    - All other services (`CheckoutService`, `PurchaseFulfillmentService`, `CloudinaryService`) export plain functions or a singleton object
    - `IMediaAuthorizationService` interface and `MediaAuthorizationService` class exist solely for constructor DI, used only in tests via mock injection
    - Fix: replace class with plain exported functions; use `vi.mock` in tests instead of constructor injection
    - Files: `MediaAuthorizationService.ts`, any test files importing it

48. 🟡 **P2** `[bug]` thumnails in galleries using image with watermark. only public lightboxes should be with watermark.

49. 🟢 **P3** `[refactor]` Hook logging and tracing into `runQuery` utility
    - Class-based `BaseRepository` was considered and rejected — plain `runQuery` in `BaseRepository.ts` is sufficient
    - `runQuery` already handles error mapping (via `mapPrismaError`); it is the single cross-cutting entry point
    - Remaining work: add optional `operationName?: string` param; call `logger.error` inside the catch block
    - Each call site passes `'RepositoryName.methodName'` — no class or `this.constructor.name` needed
    - Prerequisite: #33 (structured logger) must land first
    - Enables: consistent error logging and future tracing across all repos in one place
50. lightbox chevrons appears only on click, not visible on open

51. on checkout sometimes I see error notification that some items were already purchased. need to contemplate about mechanism to exclude from public gallery such items and expand to content storing strategy. If user buy item it's probably becomes useless for the site because who whants to buy another surfer's media?

52. I see competitor's surfcloud seeyousurf sites - they have session entity with author publicly expose instead of common mixed gallery. What content grouping fits most for such media marketplace?

53. 🟠 **P1** `[perf]` Batch media writes use N individual Prisma calls instead of one `updateMany`
    - `updateBatch`, `updatePublishedBatch`, `unpublishBatch`, and `publish` in `MediaService` each call `Promise.all(ids.map(id => updateMedia(id, data)))` — N round-trips
    - Fix: add `updateManyMedia(ids, data)` to `IMediaRepository` / `MediaRepository`, backed by `prisma.mediaItem.updateMany({ where: { id: { in: ids } }, data })`
    - Per-item price fallback in `publish` (when price is undefined, falls back to existing item price) needs to stay as individual calls until that logic is removed
    - Prerequisite: none

54. 🟡 **P2** `[perf]` `myUploads` full list refetched after every single price/date edit
    - `updatePublishedBatch` and `unpublishBatch` mutations call `queryClient.invalidateQueries(myUploads)` — reloads entire list
    - Fix: use `queryClient.setQueryData` with the returned `MediaItem[]` to patch the cache surgically
    - Prerequisite: #53 is independent; this can land separately

55. 🟡 **P2** `[perf]` Bulk delete fires N individual tRPC mutations instead of one batch call
    - `handleBulkDelete` in `_drawer.me.index.tsx` calls `deleteMedia` per item via `Promise.allSettled`
    - Fix: add `deleteBatch` endpoint in `media.ts` router + `deleteBatch` service method; split by status (drafts hard-deleted, published soft-deleted)
    - Prerequisite: none

56. checkout whithout authentication shows error, even it was implemented.
57. is it possible to load libraries like motion deferred and is it worth to do.
58. bug: no centering and filtering when select spot from search result for the first try, works ok if to search and select one more time.
59. Need to disable cursor when spot is selected in search bar. clearing selected spot with x button enables it back
60. add location to selected spot name because there are like echo beach on bali and echo beach on banyak islands.
70. if clear chip in gallery state stay there with empty state don't go to recents? or drop state entirely to Recent session mode?
