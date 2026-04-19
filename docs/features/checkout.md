# Checkout — Design Document

> Ports & Adapters · tRPC · Hono webhook · Zustand cart

The checkout module covers the full buyer lifecycle: adding items to a persistent cart, initiating a hosted payment session, fulfilling the order on webhook confirmation, and generating short-lived download URLs for purchased originals.

**Participants:** `cartStore` · `useCartItem` · `useCartSessionSync` · `CartDrawer` · `usePurchaseDownload` · `PurchasesTab` · `checkoutRouter` · `CheckoutService` · `PurchaseFulfillmentService` · `OrderRepository` · `activeAdapter` · `CryptoCloudAdapter`

### System Boundary

```
┌──────────────────────────────────────────────────────────────────┐
│  Checkout                                                        │
│                                                                  │
│  ┌─────────────┐  add/remove             ┌──────────────┐        │
│  │ useCartItem │────────────────────────▶│  cartStore   │        │
│  └─────────────┘                         └──────┬───────┘        │
│                                                 │ items          │
│  ┌─────────────┐  checkout.create   ┌───────────▼───────────┐    │
│  │ CartDrawer  │───────────────────▶│  checkoutRouter(tRPC) │    │
│  └─────────────┘                    └──────┬────────────────┘    │
│                                            │                     │
│                              ┌─────────────▼──────────────┐      │
│                              │     CheckoutService        │      │
│                              └─────────────┬──────────────┘      │
│                                            │                     │
│                              ┌─────────────▼──────────────┐      │
│                              │  activeAdapter →           │      │
│                              │  CryptoCloudAdapter        │      │
│                              └────────────────────────────┘      │
│                                                                  │
│  ┌─────────────────┐  raw POST  ┌────────────────────────────┐   │
│  │ Webhook handler │───────────▶│ PurchaseFulfillmentService │   │
│  └─────────────────┘            └────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────┐  getSignedMediaAccess                  │
│  │  usePurchaseDownload │───────────────────────▶ checkoutRouter │
│  └──────────────────────┘                                        │
├──────────────────────────────────────────────────────────────────┤
│  External: CryptoCloud API · Cloudinary · PostgreSQL             │
└──────────────────────────────────────────────────────────────────┘
```

---

## 1. Flow: Cart Management

```
useCartItem    toCartItem     cartStore    useCartSessionSync
    │               │              │               │
    │──MediaItem+──▶│              │               │
    │   spotName    │──CartItem───▶│               │
    │               │              │ persist→      │
    │               │              │ localStorage  │
    │               │              │               │
    │               │              │◄──────────────│
    │               │              │   clear()     │
    │               │              │ (sign-out)    │
```

**State:** `cartStore` owns `CartItem[]` exclusively. `useCartSessionSync` triggers `clear()` as a side-effect of auth state — it does not own cart data.

---

## 2. Flow: Checkout

```
CartDrawer    checkoutRouter    CheckoutService    OrderRepository    CryptoCloudAdapter
    │                │                  │                 │                   │
    │─checkout.create▶                  │                 │                   │
    │  { itemIds }   │──createSession─▶ │                 │                   │
    │                │                  │──findMediaByIds▶│                   │
    │                │                  │◄─ MediaItem[] ──│                   │
    │                │                  │──findPurchased─▶│                   │
    │                │                  │◄─ purchasedIds ─│                   │
    │                │                  │──createOrder───▶│                   │
    │                │                  │◄─ Order+Items ──│                   │
    │                │                  │──createSession─────────────────────▶│
    │                │                  │◄─{ checkoutUrl }────────────────────│
    │◄─{ checkoutUrl }──────────────────│                 │                   │
    │ clear + redirect                  │                 │                   │
```

**State:** `cartStore` owns items until `onSuccess` — at that point `Order (PENDING)` in DB becomes the in-flight marker. Cart is cleared immediately on redirect.

| Scenario | Handling |
|---|---|
| Item not PUBLISHED at checkout | `CheckoutService` throws, lists unavailable IDs |
| Item already purchased | `CheckoutService` throws |
| CryptoCloud API fails | `markOrderFailed(orderId)` → `BadGatewayError` |

---

## 3. Flow: Fulfillment (Webhook)

```
CryptoCloud    WebhookHandler    CryptoCloudAdapter    PurchaseFulfillmentService    DB
    │               │                   │                        │                   │
    │──POST body───▶│                   │                        │                   │
    │               │──verifyWebhook───▶│                        │                   │
    │               │◄─ bool ───────────│                        │                   │
    │               │──parseWebhook────▶│                        │                   │
    │               │◄─ WebhookEvent ───│                        │                   │
    │               │──fulfillOrder(orderId, externalId)────────▶│                   │
    │               │                   │                        │──findByExternal──▶│
    │               │                   │                        │◄─ null (new) ─────│
    │               │                   │                        │──findOrderById───▶│
    │               │                   │                        │◄─ Order+Items ────│
    │               │                   │              ┌─────────▼───────────────┐   │
    │               │                   │              │  $transaction           │──▶│
    │               │                   │              │  Order → COMPLETED      │   │
    │               │                   │              │  createMany Purchases   │   │
    │               │                   │              │  update user.balance    │   │
    │               │                   │              │  create Transactions    │   │
    │               │                   │              └─────────────────────────┘   │
    │◄─ 200 ────────│                   │                        │                   │
```

**State:** `Order.status` transitions `PENDING → COMPLETED` inside `$transaction`. `Purchase` rows are the sole ownership proof — created atomically with the Order update.

| Scenario | Handling |
|---|---|
| Signature invalid | 401, no DB writes |
| Webhook fires twice | `findOrderByExternalId` returns existing → early return |
| DB transaction fails | `$transaction` rolls back all writes atomically |

---

## 4. Flow: Download Access

```
PurchasesTab    usePurchaseDownload    checkoutRouter    CheckoutService    CloudinaryService
    │                  │                    │                  │                   │
    │──download(id)───▶│                    │                  │                   │
    │                  │──getSignedAccess──▶│                  │                   │
    │                  │                    │──generateAccess─▶│                   │
    │                  │                    │                  │──findPurchase────▶DB
    │                  │                    │                  │◄─ Purchase|null ──│
    │                  │                    │                  │──generateSigned──▶│
    │                  │                    │                  │◄─ { url, exp } ───│
    │                  │◄─ { downloadUrl } ─│◄─────────────────│                   │
    │                  │──window.open(url)  │                  │                   │
```

**State:** `usePurchaseDownload` owns `downloadingId` — prevents concurrent downloads. The URL is never stored — generated fresh per request and discarded after `window.open`.

---

## 5. Design Invariants

```
INVARIANT: Server-Only Pricing
  Rule:    Item prices are always read from DB — never from client input or webhook payloads.
  Ensured: CheckoutService re-fetches MediaItem.price before computing totals.
           PurchaseFulfillmentService reads price from MediaItem rows, not from Order.totalAmount.
  Breaks:  Price manipulation — buyer submits forged prices at checkout.

INVARIANT: ItemIds From DB at Fulfillment
  Rule:    The webhook payload never determines which items were purchased.
  Ensured: OrderItem rows are written at order creation. PurchaseFulfillmentService reads
           them via findOrderById — the webhook supplies only orderId and externalOrderId.
  Breaks:  Attacker replays webhook claiming different items were purchased.

INVARIANT: Single Active Adapter
  Rule:    All payment interactions go through one adapter, resolved at one location.
  Ensured: activeAdapter.ts is the sole import point for both CheckoutService and the
           webhook handler. Swapping providers = changing one file.
  Breaks:  Two services use different adapters — signature verification fails for one of them.

INVARIANT: Atomic Fulfillment
  Rule:    Order update, Purchase creation, balance increment, and Transaction creation
           must all succeed or all fail together.
  Ensured: PurchaseFulfillmentService wraps all writes in prisma.$transaction.
  Breaks:  Order marked COMPLETED without Purchase rows, or balance incremented without audit.

INVARIANT: Purchase-Gated Downloads
  Rule:    A signed download URL is only generated after confirming a Purchase row exists
           for the requesting buyer and the specific mediaItemId.
  Ensured: CheckoutService.generateDownloadAccess checks findPurchaseByBuyerAndMedia first.
           ForbiddenError thrown if absent. URL never stored — regenerated per request.
  Breaks:  Any authenticated user accesses originals by guessing a mediaItemId.
```
