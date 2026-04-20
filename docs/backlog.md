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

26. 🔴 **P0** `[bug]` Users can add their own published media to the cart

27. 🟠 **P1** `[error-handling]` Audit server service error handling — apply the same abstract error pattern used in `CheckoutService` consistently across all services

28. 🔴 **P0** `[security]` `media.signCloudinary` — no folder ownership check; any authenticated user can obtain a valid upload signature for another user's spot folder
    - `folder` input is `z.string().optional()` with no ownership check
    - Fix: extract spotId from folder param, query DB to verify `spot.photographerId === ctx.user.id`, throw `FORBIDDEN` if not
    - File: `src/server/routes/media.ts` → `signCloudinary` procedure
    - Open question: does each user need their own isolated Cloudinary folder?

29. 🔴 **P0** `[security]` `media.create` — `thumbnailUrl` and `lightboxUrl` accept any URL, allowing external URL injection
    - Currently any URL passes `z.url()` validation — a user could store arbitrary external URLs in the DB
    - Fix: add Zod `.refine()` requiring both URLs start with `https://res.cloudinary.com/{CLOUDINARY_CLOUD_NAME}/`
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

33. 🟡 **P2** `[logging]` Add structured server-side logger — replace all raw `console.*` calls
    - Risk: raw `err` objects in production may expose Cloudinary internals, stack traces, or the API secret
    - Create `src/server/lib/logger.ts` with env-aware `warn` / `error` methods (full error in dev, message-only in prod)
    - Migrate `CloudinaryService.tryGeneratePermanentPreviewUrl` → `logger.warn`
    - Future upgrade path: swap internal `console.*` for `pino` or OpenTelemetry in one file
    ```ts
    export const logger = {
      warn(message: string, err?: unknown) {
        process.env.NODE_ENV === 'production' ? console.warn(message) : console.warn(message, err);
      },
      error(message: string, err?: unknown) {
        process.env.NODE_ENV === 'production' ? console.error(message) : console.error(message, err);
      },
    };
    ```

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

36. 🔴 **P0** `[security]` Upload pipeline is missing four validation guards
    1. **Folder ownership**: verify the target spot belongs to the current user before signing (see #28)
    2. **File type whitelist**: validate `resource_type` in `media.create` against an allowlist in `MEDIA_UPLOAD_CONFIG`
    3. **File size limit**: check `file.size` before XHR in `cloudinary-client.ts`; reject if > `MAX_FILE_SIZE` (e.g. 100 MB)
    4. **Rate limiting**: cap `media.signCloudinary` at e.g. 10 signatures/user/minute
    - Files: `src/server/routes/media.ts`, `src/entities/Media/constants.ts`, `src/shared/lib/cloudinary-client.ts`, `src/server/middleware/rateLimiter.ts` (NEW)

37. 🔴 **P0** `[security]` Webhook endpoint has no rate limiting — susceptible to replay-flood DoS
    - Public URL — a captured valid payload can be replayed indefinitely; each replay passes signature check and hits the DB
    - Fix: middleware tracking requests per IP (and/or `invoice_id`); reject with HTTP 429 above threshold (e.g. 20 req/min per IP)
    - Files: `src/server/index.ts`, `src/server/middleware/rateLimiter.ts` (NEW or extend from #36)

38. 🔴 **P0** `[security]` Webhook fulfillment: non-atomic idempotency check — vulnerable to race-condition double fulfillment
    - App-level `if order.status === FULFILLED → return` is not atomic; two simultaneous webhooks can both pass before either writes `FULFILLED`
    - Fix: add `@@unique([externalOrderId])` on `Order` in Prisma schema; P2002 → `ConflictError` → transaction rolls back
    - Files: `prisma/schema.prisma`, migration, `PurchaseFulfillmentService.ts` (catch `ConflictError` as idempotent success)

39. 🟠 **P1** `[error-handling]` Wire `PrismaErrorMapper` into all repositories — it is implemented but never called
    - P2002/P2025 currently surface to the client as generic `INTERNAL_SERVER_ERROR`
    - Fix: wrap write operations in try/catch → `throw mapPrismaError(err)` in `OrderRepository`, `MediaRepository`, and others
    - Required by #38: the unique-constraint race fix depends on P2002 mapping to `ConflictError`

40. 🟠 **P1** `[error-handling]` Payment adapters throw plain `new Error()` — internal provider details may leak to the client
    - Not `HttpError` instances → tRPC may include the raw `.message` in the response body (leaks provider names and internal API responses)
    - Fix: replace runtime API failure throws with `new InternalServerError('Payment provider error')` and log details via `logger.error` (#33)
    - Files: `CryptoCloudAdapter.ts`, `CryptomusAdapter.ts`, `NOWPaymentsAdapter.ts`, `LemonSqueezyAdapter.ts`

41. 🔴 **P0** `[error-handling]` Webhook handler has no try/catch around `handleEvent` — uncontrolled 500 exposes stack traces and triggers dangerous provider retries on partially-written fulfillments
    - Fix: wrap in try/catch, log safely via `logger.error` (#33), return a controlled `{ error: 'Fulfillment error' }` with status 500
    - Note: returning 500 intentionally so the provider retries — safe only after #38 and #39 are in place
    ```ts
    try {
      await webhookService.handleEvent(rawBody);
    } catch (err) {
      logger.error('[webhook] Fulfillment failed', err);
      return c.json({ error: 'Fulfillment error' }, 500);
    }
    ```

42. ✅ ~~Flatten `SpotRepository.ts` — remove `ISpotRepository` interface and `PrismaSpotRepository` class; replace with plain exported async functions~~

43. ✅ ~~Flatten `OrderRepository.ts` — remove `IOrderRepository`, `PrismaOrderRepository`, and `orderRepository` singleton; keep named exports~~

44. 🟠 **P1** `[server]` `PurchaseFulfillmentService.ts` bypasses the repository layer — calls `prisma.mediaItem.findMany` and `prisma.$transaction` directly
    - Discovered during `users.ts` audit (April 2026)
    - Fix: add `MediaRepository.findByIds()`; verify `$transaction` block is fully delegated to `OrderRepository.fulfill`

45. 🟠 **P1** `[server]` `spots.ts` tRPC route calls `prisma.mediaItem.findMany` directly (line ~131) — should go through `MediaRepository`
    - Discovered during `users.ts` audit (April 2026)
    - Fix: add `MediaRepository.findPublishedBySpot(spotId)` and call it from the route

46. 🟡 **P2** `[refactor]` `CheckoutService.ts` leaks `Prisma.Decimal` above the repository boundary
    - `import { Prisma } from '@prisma/client'` used in service-internal type `MediaItem.price: Prisma.Decimal` and in `computeTotal`
    - Same violation fixed in `PurchaseFulfillmentService` (April 2026) — apply the same pattern here
    - Fix: translate `price` to `number` inside `findMediaByIds` (repository boundary); remove `Prisma` import from `CheckoutService`; update `computeTotal` and `createOrder` call to use plain arithmetic
    - Files: `CheckoutService.ts`, `MediaRepository.findMediaByIds`

47. 🟡 **P2** `[refactor]` `MediaAuthorizationService.ts` uses a class + interface pattern inconsistent with the rest of the services layer
    - All other services (`CheckoutService`, `PurchaseFulfillmentService`, `CloudinaryService`) export plain functions or a singleton object
    - `IMediaAuthorizationService` interface and `MediaAuthorizationService` class exist solely for constructor DI, used only in tests via mock injection
    - Fix: replace class with plain exported functions; use `vi.mock` in tests instead of constructor injection
    - Files: `MediaAuthorizationService.ts`, any test files importing it

