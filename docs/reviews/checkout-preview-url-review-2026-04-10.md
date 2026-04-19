# Code Review: Checkout — Purchase Preview URL & Security Hardening
Date: 2026-04-10
Reviewed by: GitHub Copilot

## Summary
- 🔴 Critical: 1 issue
- 🟡 Warning: 5 issues
- 🟢 Suggestion: 5 issues

## Mission Alignment
Goal was met: purchasePreviewUrl moved from MediaItem (public leak risk) to Purchase row (generated at fulfillment, gated by auth). Naming inconsistencies resolved. Open redirect via client-supplied `successBaseUrl` fixed. Purchases gallery UI wired with clean lightbox modal.

---

## Issues

### 🔴 Critical

#### Cloudinary failure can silently block purchase fulfillment
- **File**: `src/server/services/WebhookService.ts` (~line 75)
- **Problem**: `generatePermanentPreviewUrl()` is called inside the `.map()` that builds the `purchases` array, before `orderRepository.fulfill()`. If Cloudinary is misconfigured or throws, `fulfill()` never runs — the buyer paid but receives no `Purchase` row. This is a data integrity risk.
- **Concept**: Insecure Design (OWASP #4) — a secondary operation (preview URL generation) blocking the primary one (order fulfillment)
- **Fix**: Wrap the call in try/catch and fall back to `null`. `previewUrl` is nullable in the schema for exactly this reason:
  ```ts
  previewUrl: (() => {
    try { return cloudinaryService.generatePermanentPreviewUrl(item.cloudinaryPublicId); }
    catch { return null; }
  })()
  ```
  Or generate the preview URL as a best-effort post-insert step after `fulfill()` succeeds.

---

### 🟡 Warnings

#### APP_URL validated at call time, not at startup
- **File**: `src/server/services/CheckoutService.ts` (~line 43)
- **Problem**: `process.env.APP_URL` is checked inside `createCheckoutSession()`. A missing env var only surfaces on the first checkout attempt by a real user, not at server boot.
- **Concept**: Security Misconfiguration (OWASP #5) — misconfiguration should fail fast
- **Fix**: Validate `APP_URL` in `container.ts` or server bootstrap alongside other env guards.

#### Route imports data layer directly — business logic in route handler
- **File**: `src/server/routes/checkout.ts` (lines 4–6, 30, 56)
- **Problem**: `checkout.ts` imports `orderRepository`, `prisma`, and `cloudinaryService` directly. `getSignedMediaAccess` and `myPurchases` contain DB queries and service calls that belong in `CheckoutService`. Routes should be thin coordinators.
- **Concept**: Single Responsibility Principle — route = input validation + delegation only
- **Fix**: Move `getSignedMediaAccess` logic into `CheckoutService.generateDownloadAccess(buyerId, mediaItemId)` and `myPurchases` into `CheckoutService.getPurchases(buyerId)`.

#### WebhookService has two responsibilities
- **File**: `src/server/services/WebhookService.ts`
- **Problem**: The service now handles payment lifecycle events **and** Cloudinary URL generation. These are separate concerns — a Cloudinary change (e.g. different transform name) requires touching `WebhookService`.
- **Concept**: Single Responsibility Principle
- **Fix**: Consider a `PurchaseFulfillmentService` that wraps `orderRepository.fulfill()` and handles the Cloudinary preview generation, keeping `WebhookService` focused on webhook parsing/routing only.

#### findPurchasesByBuyerId has no LIMIT
- **File**: `src/server/repositories/OrderRepository.ts` (~line 78)
- **Problem**: A buyer with many purchases loads all rows in one query — thumbnailUrls + previewUrls for every item.
- **Concept**: Performance — unbounded queries
- **Fix**: Add pagination (`take` / `skip`) or a `limit` param. Not urgent for an MVP but needs addressing before scale.

#### FSD violation — checkout route imports concrete singletons
- **File**: `src/server/routes/checkout.ts` (lines 4–6)
- **Problem**: Route imports `orderRepository`, `prisma`, `cloudinaryService` as concrete singletons rather than receiving them via the container or service layer. Makes the route untestable in isolation.
- **Concept**: Dependency Inversion Principle
- **Fix**: Route should only import `checkoutService` from `container`. The service owns all further dependencies.

---

### 🟢 Suggestions

#### Schema comment missing on Purchase.previewUrl
- **File**: `prisma/schema.prisma` (Purchase model)
- **Problem**: No comment explaining why `previewUrl` lives on `Purchase` rather than `MediaItem`.
- **Fix**: Add `// Generated at fulfillment via CloudinaryService.generatePermanentPreviewUrl — null for pre-feature purchases`

#### No guard for empty cloudinaryPublicId in generatePermanentPreviewUrl
- **File**: `src/server/services/CloudinaryService.ts`
- **Problem**: Cloudinary SDK will silently sign a URL for a blank `publicId`. Seed data or test fixtures could trigger this.
- **Fix**: Add at the top of the method:
  ```ts
  if (!cloudinaryPublicId) throw new InternalServerError('Missing cloudinaryPublicId');
  ```

#### Modal image has no loading state
- **File**: `src/app/routes/_drawer.me.purchases.tsx`
- **Problem**: Modal opens with blank white space while Cloudinary image loads over the network.
- **Fix**: Add a `Skeleton` behind the `<Image>` that hides when the image loads, or use Mantine's `<Image fallbackSrc>`.

#### Stale JSDoc comment on getSignedMediaAccess
- **File**: `src/server/routes/checkout.ts` (line 43)
- **Problem**: Comment says "Returns both a watermark-free lightbox preview and a download URL" — `previewUrl` is no longer returned here; it comes from the Purchase row via `myPurchases`.
- **Fix**: Update to: "Returns a short-lived signed download URL for the purchased original. Preview is served from the Purchase row via myPurchases."

#### No logging when previewUrl generation fails
- **File**: `src/server/services/WebhookService.ts`
- **Problem**: If `generatePermanentPreviewUrl` throws and is caught silently, there's no trace in logs. The buyer sees no preview but no alert fires.
- **Fix**: Log a warning (not error, since fulfillment still succeeds) so the issue is visible in production monitoring.

---

## What Was Done Well
- **Open redirect eliminated cleanly** — `successBaseUrl` removed from client entirely; `APP_URL` in env is the right pattern
- **previewUrl placement is architecturally correct** — on `Purchase`, not `MediaItem`; zero leak path to unauthenticated callers
- **Purchase ownership check is rock solid** — every URL-generating endpoint verifies `buyerId + mediaItemId` match a real Purchase row
- **fulfill() transaction is atomic** — purchases, balances, and transactions succeed together or not at all
- **Naming is now consistent and use-case based** — `lightboxUrl` (public watermarked), `generateSignedDownload` (original access) — clear intent at a glance

## Recommended Next Steps
1. 🔴 Wrap `generatePermanentPreviewUrl` in try/catch inside `handleOrderCompleted` — fulfillment must not depend on Cloudinary availability
2. 🟡 Validate `APP_URL` at server startup in `container.ts`
3. 🟡 Move `getSignedMediaAccess` and `myPurchases` DB logic into `CheckoutService`
4. 🟡 Add pagination to `findPurchasesByBuyerId`
5. 🟢 Add `previewUrl` schema comment, image loading state, fix stale JSDoc
