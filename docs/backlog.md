1. ~~client has views and src has views need to spread to FSD's directories?~~
2. ~~if to delete drafts from spot upload tab it will not refresh indicator on my collection my uploads tab.~~
3. ~~uploading plate on main page replaces a user menu control.~~
4. opening any drawer or menu should close others (for example now preview spot card is still open if to open user menu or even My collection drawer)
5. Need to block publish button untill specified date/price are applied.
6. ~~When selected drafts need to propose publishing only selected button will be (publish {count} instead of all)~~
7. when I open browser with sidepanel opened I see it closed and opens again even if it was in open state (repeat cycle of opening each time I make browser window active). And sliding in animation on standalone page opening looks wierd.
8. spots names are not human readable slugs in url.
   - Recommended approach: TanStack Router `loader` on `$spotName` route resolves slug → spot entity before component renders
   - `GlobeMapComponent` already accepts `initialSpotId` prop — routing layer owns the resolution, widget stays routing-agnostic
   - Consider Option A (ID-embedded slug e.g. `/bali-soul--cm9x2k3f4`) for zero-lookup simplicity, or Option C (server loader) for clean URLs
9. [post-MVP] "Suggest a better name" — allow users to propose a new primary name for a spot (e.g. from the spot panel). If accepted, it replaces `name` and the old name is automatically moved to `aliases` so existing searches still resolve.
10. preview card photos are one above another not in carrousel. Need to contemplate about what media should be there. Either last uploaded photo or just photos best representing the spot uplaoded via admin panel.
11. Set allowed URLs for the Mapbox public token in the Mapbox dashboard (https://account.mapbox.com/access-tokens/) to restrict usage to production and staging domains and prevent quota abuse.
12. ~~Audit data fetching across all components — is it correct everytime call const trpc = useTRPC() do we need a additional abstraction like action or something?; Also verify all error paths use `shared/errors` utilities (`getErrorMessage`, `ClientErrors`, etc.) consistently rather than ad-hoc strings.~~
13. Add Spot panel is too bulky need to make it more compact (so it not hide map).
14. There is a problem with search results presentation and ux one item takes to much height.
15. ~~[server consistency] `spots.ts` tRPC route calls Prisma directly; `media.ts` uses `mediaRepository` + service layer. Extend the repository/service pattern to spots: create `SpotRepository` + `ISpotRepository` in `shared/api/repositories/` mirroring `MediaRepository`.~~
16. [feature] Support uploading media from Google Drive
    - **Decision**: do NOT use Cloudinary Upload Widget for this. The widget imports Drive files immediately, consuming storage/transform/bandwidth quota regardless of whether the photographer ever publishes. For a marketplace this is a significant uncontrolled cost.
    - **Chosen architecture**: Google Picker API (client) + server-side Cloudinary URL upload (at publish time)
      1. User authorises Google Picker (OAuth) — no Cloudinary involved
      2. Picker returns a Drive file URL/ID — stored in DB (e.g. `media_items.drive_url`) with status `DRIVE_PENDING`
      3. At publish: server calls Cloudinary Upload API with `file: driveUrl` — Cloudinary fetches and transforms at that point
      4. Quota only consumed on publish, never on browse/select
    - **Keep current XHR pipeline** for direct file uploads — it provides progress tracking, per-file abort, and full UI control which the widget does not
    - **Drive path adds**: Google OAuth flow, Picker API integration (client), new `DRIVE_PENDING` media status, server endpoint that triggers Cloudinary URL-fetch on publish
    - **Quota risk mitigation**: apply same file size/type validation from backlog #36 at the Cloudinary URL-fetch step
17. fix silent swallowing of errors
18. design payment system
19. consider about limits for photographers: how much they can upload. add a visual indicator of uploads limit usage
20. add virtulized lists for galleries.
21. free photos shouldn't have watermarks in lightbox preview.
22. design ux for showing original file's resolution and properties.
23. update edit price control to have a floor $3
close preview card if any drawer opens, not only from card itself
24. add buy now bypass of cart
25. to sort out video.
26. user can add to cart his own published media.
27. audit server services errors as for checkout Service with abstract errors
28. [security] `media.signCloudinary` — validate folder belongs to authenticated user's spot before signing
    - The `folder` input is `z.string().optional()` with no ownership check
    - A logged-in user can pass any spotId in the folder path and get a valid signature for it
    - Fix: in `signCloudinary` mutation, extract spotId from folder string, query DB to confirm `spot.photographerId === ctx.user.id`, throw `FORBIDDEN` if not
    - Affected file: `src/server/routes/media.ts` → `signCloudinary` procedure

    need to contemplate If user needs it's own folder at cloudinary.
29. [security] `media.create` — validate that `thumbnailUrl` and `lightboxUrl` originate from our Cloudinary account
    - Currently any URL passes `z.url()` validation — a user could inject arbitrary external URLs
    - Fix: add a Zod `.refine()` check that both URLs start with `https://res.cloudinary.com/{CLOUDINARY_CLOUD_NAME}/`
    - Read `VITE_CLOUDINARY_CLOUD_NAME` server-side to build the allowed prefix
    - Affected file: `src/server/routes/media.ts` → `create` procedure input schema
30. [ux/feature] Owner's upload gallery shows watermarked lightbox after page refresh
    - During active session `previewUrl` is a local blob URL (clean, no watermark) ✓
    - After refresh, server-only drafts use `draft.lightboxUrl` which is the watermarked public variant ✗
    - Fix: add a third eager transform at upload time — `t_wave_atlas_lightbox_owner` (800px, no watermark, authenticated delivery)
    - Store it in a new DB column `ownerLightboxUrl` on `MediaItem`
    - In `useUploadQueue.ts` server-only draft mapping, use `draft.ownerLightboxUrl` as `previewUrl`
    - In `UploadCardRenderer.tsx` completed state, prefer `ownerLightboxUrl` over `lightboxUrl`
    - Requires: new Cloudinary named transform, new Prisma migration, updated `MediaRepository.create`, updated `UploadPipeline.saveToDatabase`
31. [performance] `media.updateBatch` does 2 DB reads per item — collapse into 1
    - Currently: `ensureCanModify()` does `findById` (read #1), then route does `findById` again for status check (read #2)
    - For a batch of 20 items this is 40 DB round-trips instead of 20
    - Fix: extend `ensureCanModify()` to also return the status, or add a combined `ensureCanModifyDraft(userId, mediaId)` method to `MediaAuthorizationService` that checks both `photographerId === userId` AND `status === DRAFT` in one query
    - Then remove the separate `mediaRepository.findById(id)` call from the route
    - Affected files: `src/server/services/MediaAuthorizationService.ts`, `src/server/routes/media.ts` → `updateBatch` procedure

32. change photographerId to ownerId or authorId or creatorId.
33. [logging] Add structured server-side logger utility to replace raw `console.*` calls
    - **Why**: currently only one `console.warn` exists in server code (CloudinaryService.tryGeneratePermanentPreviewUrl).
      In production this logs the raw `err` object which can contain Cloudinary SDK internals, stack traces,
      and potentially the API secret if the SDK includes it in error messages — a log aggregation leak risk.
    - **Goal**: dev sees full error; prod logs only the safe message string.
    - **Approach**: create `src/server/lib/logger.ts`:
      ```ts
      export const logger = {
        warn(message: string, err?: unknown) {
          if (process.env.NODE_ENV === 'production') {
            console.warn(message); // message only — no raw error
          } else {
            console.warn(message, err); // full error for local debugging
          }
        },
        error(message: string, err?: unknown) {
          if (process.env.NODE_ENV === 'production') {
            console.error(message);
          } else {
            console.error(message, err);
          }
        },
      };
      ```
    - **Migration**: replace the `console.warn` in `CloudinaryService.tryGeneratePermanentPreviewUrl` with `logger.warn`
    - **Pattern for future use**: all server-side `catch` blocks should use `logger.error/warn` — never raw `console.*`

34. [performance] Gallery infinite scroll + virtualised list
    - **Why**: spot galleries (GlobeScene, SpotPanel) will grow unboundedly — loading all media upfront wastes bandwidth and blocks render.
    - **Scope**: server cursor pagination + client infinite scroll + DOM virtualisation.
    - **Server**: add `cursor`/`limit` params to `spots.details` and/or dedicated `media.listBySpot` tRPC procedure. Use Prisma cursor pagination (`cursor: { id }, skip: 1, take: limit`).
    - **Client**: replace current `useQuery` with `useInfiniteQuery` (`trpc.*.useInfiniteQuery`). `getNextPageParam` reads last item id as next cursor.
    - **Virtualisation**: use `@tanstack/react-virtual` (`useVirtualizer`) for the gallery grid — only renders visible rows.
    - **Entry points to change**: `views/SpotPanel`, `views/GlobeScene`, relevant tRPC routes.
    - **Note**: `_drawer.me.purchases.tsx` is intentionally excluded — 50-item cap (already applied) is sufficient for purchases.
    - **Future upgrade path**: swap `console.*` inside `logger.ts` for `pino` or OpenTelemetry — one file change, nothing else moves
    - **Files to touch**:
      - `src/server/lib/logger.ts` — NEW
      - `src/server/services/CloudinaryService.ts` — replace `console.warn` with `logger.warn`
      - `src/server/index.ts` — replace `console.log('Server running...')` with `logger.info` (add `info` level)

35. [performance] Prefetch lightbox image on card hover in purchases gallery
    - **Why**: currently the full-resolution Cloudinary URL only starts loading when the modal opens — on slow connections there's a 1-3s blank modal. Prefetching on hover hides that latency behind user think time.
    - **What**: use `queryClient.prefetchQuery` with a custom `queryFn` that creates an `Image` object and waits for `onload`. When the modal opens, the browser has the image in its HTTP cache — render is instant.
    - **How**:
      ```ts
      // shared/lib/prefetchImage.ts
      export function prefetchImage(queryClient: QueryClient, src: string) {
        queryClient.prefetchQuery({
          queryKey: ['image', src],
          queryFn: () => new Promise<void>((resolve, reject) => {
            const img = new window.Image();
            img.onload = () => resolve();
            img.onerror = reject;
            img.src = src;
          }),
          staleTime: Infinity, // browser cache handles freshness
        });
      }
      ```
      Call `prefetchImage(queryClient, p.previewUrl)` on card `onMouseEnter`.
    - **Component**: `LightboxImage` reads `useState(false)` for loaded, resets via `key={src}` — no change needed there.
    - **File to touch**: `src/app/routes/_drawer.me.purchases.tsx` — add `onMouseEnter` to each `<Card>`.

36. [security] Upload validation: file type, size, folder ownership, rate limiting
    - **Why**: currently users can bypass restrictions:
      1. Folder ownership: no validation that folder belongs to their spot (can upload to another user's folder)
      2. File type: no whitelist — could upload PDFs, executables, or other non-media files
      3. File size: no client or server guard — can waste quota with massive files
      4. No rate limiting: user can spam upload requests
    - **Scope**: 4 independent fixes:
      - **Folder ownership** (backlog #28 expansion): in `media.signCloudinary` mutation, extract spotId from folder param, query DB to verify `spot.photographerId === ctx.user.id`, throw FORBIDDEN if not
      - **File type whitelist**: in `media.create` mutation, validate `cloudinaryResult.resource_type` is in allowed types (image, video). Add to MEDIA_UPLOAD_CONFIG constant
      - **File size limit**: in `cloudinary-client.ts` `uploadToCloud`, check `file.size` before XHR, reject if exceeds MEDIA_UPLOAD_CONFIG.MAX_FILE_SIZE (e.g. 100MB)
      - **Rate limiting**: add middleware or request limiter on `media.signCloudinary` — e.g. max 10 signatures per user per minute
    - **Files to touch**:
      - `src/server/routes/media.ts` — `signCloudinary` folder owner check, `create` resource type whitelist
      - `src/entities/Media/constants.ts` — add MAX_FILE_SIZE, ALLOWED_RESOURCE_TYPES
      - `src/shared/lib/cloudinary-client.ts` — file size check before upload
      - `src/server/middleware/rateLimiter.ts` — NEW (or reuse existing if available)
    - **Related**: backlog #28 (folder ownership is the first priority)

37. [security] Webhook endpoint: rate limiting to prevent replay-flood DoS
    - **Why**: the webhook endpoint (`/api/webhooks/*`) is a public URL. An attacker who has captured a genuine webhook payload (valid signature) can replay it indefinitely. Each replay passes signature verification and hits the DB (idempotency check). A sustained flood causes DB load degradation.
    - **Fix**: apply rate limiting on the webhook endpoint by IP and/or by `invoice_id` (or equivalent external order identifier per provider).
    - **Approach**: middleware that tracks request counts per key in memory (or Redis for multi-instance). Reject with HTTP 429 after threshold exceeded (e.g. 20 requests/minute per IP).
    - **Files to touch**:
      - `src/server/index.ts` — apply rate limiter middleware before webhook route registration
      - `src/server/middleware/rateLimiter.ts` — NEW (or extend from backlog #36 rate limiter)

38. [security] Webhook fulfillment: add unique DB constraint on `externalOrderId` to prevent race-condition double fulfillment
    - **Why**: the current idempotency check (`if order.status === FULFILLED → return`) is application-level and non-atomic. Two identical webhooks arriving simultaneously can both pass the check before either writes `FULFILLED`, causing double fulfillment (photographer paid twice, Cloudinary preview generated twice).
    - **Fix**: add a unique constraint on `Order.externalOrderId` at the database level. The second concurrent insert will throw Prisma `P2002` (unique violation) → `PrismaErrorMapper` converts it to `ConflictError` → transaction rolls back automatically.
    - **This makes idempotency atomic** — the DB enforces uniqueness, not application code.
    - **Files to touch**:
      - `prisma/schema.prisma` — add `@@unique([externalOrderId])` on `Order` model
      - Run migration
      - `src/server/services/PurchaseFulfillmentService.ts` — catch `ConflictError` on fulfillment insert and treat as idempotent success (already fulfilled)

39. [error handling] Wire `PrismaErrorMapper` into repositories
    - **Why**: `shared/errors/PrismaErrorMapper.ts` (with `mapPrismaError()`) is fully implemented but never called. All Prisma errors (P2002 unique violation, P2025 not found, etc.) currently surface to the client as generic `INTERNAL_SERVER_ERROR` instead of their correct `CONFLICT` / `NOT_FOUND` equivalents.
    - **Fix**: in each repository method that writes to the DB, wrap the Prisma call in a try/catch and call `mapPrismaError(err)`:
      ```ts
      try {
        return await prisma.order.create({ ... });
      } catch (err) {
        throw mapPrismaError(err); // P2002 → ConflictError, P2025 → NotFoundError, etc.
      }
      ```
    - **Scope**: `OrderRepository`, `MediaRepository`, and any other repository with write operations.
    - **Note**: read-only queries (findById, findMany) only need wrapping if they can throw P2025 (record not found) and you want a typed `NotFoundError` response.
    - **Related**: backlog #38 depends on this — the unique constraint race-condition fix requires P2002 to map to `ConflictError`.

40. [error handling] Payment adapters throw plain `new Error()` for runtime API failures — messages may leak to client
    - **Why**: errors like `new Error('CryptoCloud invoice creation failed (500): ...')` propagate through the tRPC `errorFormatter`. Because they are not `HttpError` instances, `isHttpError` is false and tRPC may include the raw `.message` in the response body — leaking that CryptoCloud is used and exposing internal API response content.
    - **Affected files**: `CryptoCloudAdapter.ts`, `CryptomusAdapter.ts`, `NOWPaymentsAdapter.ts`, `LemonSqueezyAdapter.ts` — all throw plain `new Error()` for HTTP failure cases (not for env-var startup guards, which are fine as-is).
    - **Fix**: replace runtime API failure throws with `new InternalServerError('Payment provider error')`. The safe human-readable message goes to the client; the raw API response is logged via the logger (#33).
    - **Pattern**:
      ```ts
      // before
      throw new Error(`CryptoCloud invoice creation failed (${response.status}): ${text}`);
      // after
      logger.error('[CryptoCloudAdapter] Invoice creation failed', { status: response.status, body: text });
      throw new InternalServerError('Payment provider error');
      ```

41. [error handling] Webhook handler missing try/catch around `handleEvent` — uncontrolled 500 on fulfillment failure
    - **Why**: in `src/server/index.ts`, `await webhookService.handleEvent(rawBody)` has no try/catch. If fulfillment throws (e.g. DB is down), Hono returns an uncontrolled 500 with potential stack trace exposure. More importantly, payment providers (CryptoCloud etc.) treat 5xx as transient and **retry** — retrying on a partially-written fulfillment is dangerous.
    - **Fix**: wrap `handleEvent` in a try/catch inside the webhook route. Log the error safely (#33) and return a controlled 500 with no internal details:
      ```ts
      try {
        await webhookService.handleEvent(rawBody);
      } catch (err) {
        logger.error('[webhook] Fulfillment failed', err);
        return c.json({ error: 'Fulfillment error' }, 500);
      }
      ```
    - **Note**: returning 500 intentionally so the payment provider retries — but with the DB-level unique constraint (#38) and `PrismaErrorMapper` (#39) wired, a retry on a completed order will be safely caught by idempotency.

42. ~~[refactor] Flatten `SpotRepository.ts` — remove `ISpotRepository` interface and `PrismaSpotRepository` class; replace with plain exported async functions mirroring what was done to `MediaRepository`. Interface is unused (no DI, no mocks). Same dead-abstraction pattern.~~
43. ~~[refactor] Flatten `OrderRepository.ts` — same dead-abstraction pattern (`IOrderRepository`, `PrismaOrderRepository`, `orderRepository` singleton). The `fulfill` method wraps a real Prisma `$transaction` so it earns its own function; the rest are trivial pass-throughs. Remove class + interface, keep named exports.~~

44. [server consistency] `PurchaseFulfillmentService.ts` bypasses repository layer — calls `prisma.mediaItem.findMany` and `prisma.$transaction` directly instead of delegating to `MediaRepository` and `OrderRepository`.
    - Discovered during `users.ts` audit (April 2026).
    - Fix: extract the `mediaItem.findMany` call into a `MediaRepository` function (e.g. `findByIds`). The `$transaction` block already belongs in `OrderRepository.fulfill` — verify it's fully delegated.

45. [server consistency] `spots.ts` tRPC route calls `prisma.mediaItem.findMany` directly (line ~131) — should delegate to `MediaRepository`.
    - Discovered during `users.ts` audit (April 2026).
    - Fix: add a `findPublishedBySpot(spotId)` function to `MediaRepository` and call it from the route.


