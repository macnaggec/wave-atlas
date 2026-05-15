# CheckoutService — Test Map

Maps each user journey step to what can go wrong and which test covers it.

---

## Journey 1 — Buyer completes a purchase

```
Buyer adds items to cart
        |
        v
[ 1. Buyer submits cart ]
        |
        v
[ 2. System validates cart ]
        |
        v
[ 3. System creates order in DB ]
        |
        v
[ 4. System calls payment provider ]
        |
        v
[ 5. Buyer lands on payment page ]
        |
        v
[ 6. Buyer pays and is redirected back ]
        |
        v
[ 7. Buyer sees their purchases ]
```

---

### Step 1 — Buyer submits cart

| What can go wrong | Test |
|---|---|
| Cart is empty | `throws BadRequestError when cart is empty` |

---

### Step 2 — System validates cart

| What can go wrong | Why it matters | Test |
|---|---|---|
| An item ID doesn't exist in DB | Client could send a fabricated ID | `throws BadRequestError when an item id does not exist in DB` |
| An item is not PUBLISHED (e.g. DRAFT) | Item was unpublished after it was added to cart | `throws BadRequestError when a cart item is not published` |
| A Drive item's remote file was deleted | Photographer deleted it from Drive after registering | `throws BadRequestError when a GOOGLE_DRIVE item is no longer available` |
| importSource not forwarded to the availability checker | Checker would receive wrong source type and could misidentify the provider | `calls verifyRemoteAvailability with the item importSource for GOOGLE_DRIVE items` |
| Drive availability check skipped for normal items | Calling Drive API on every item would be slow and wrong | `does not call verifyRemoteAvailability for DIRECT items` |
| Buyer is purchasing their own media | Not a valid transaction | `throws BadRequestError when buyer tries to purchase their own media` |
| Buyer already bought this item | Would create a duplicate purchase row | `throws BadRequestError when buyer already purchased an item` |
| Price comes from the client | Client could send price: 1 for a $20 item | `passes totalCents derived from DB prices — not from client input` |

---

### Step 3 — System creates order

This step must happen **before** payment is called. If payment is called first and the DB write fails afterward, the buyer is charged with no order in the system.

| Design contract | Why it matters | Test |
|---|---|---|
| Order is created before calling the payment adapter | Payment can succeed but the DB write can still fail — if payment goes first, the buyer is charged with no order in the system and there is nothing to recover from | `creates the order before calling the payment adapter` |

---

### Step 4 — System calls payment provider

| What can go wrong | Why it matters | Test |
|---|---|---|
| Payment provider is down | Order exists in DB but payment never happened — must be cleaned up | `marks the order as FAILED and throws BadGatewayError when payment adapter rejects` |
| Redirect URL is the same for both authenticated and guest buyers | Authenticated buyer lands on wrong page after payment | `passes authenticated success URL to payment adapter when buyerId is set` |
| Redirect URL is the same for both authenticated and guest buyers | Guest buyer lands on wrong page after payment | `passes guest success URL to payment adapter when buyerId is null` |
| Guest checkout skips duplicate-purchase check | Guests have no buyerId — the check would crash or behave incorrectly | `skips duplicate-purchase check for guest checkout (buyerId = null)` |

---

### Step 5–6 — Payment page and redirect

These steps happen entirely inside the payment provider (CryptoCloud). Not tested here — the provider handles it.

---

### Step 7 — Buyer sees their purchases

Covered by Journey 2 below.

---

## Journey 2 — Buyer views and downloads a purchase

```
Buyer opens purchases page
        |
        v
[ 1. System loads purchases for buyer ]
        |
        v
[ 2. Buyer clicks download ]
        |
        v
[ 3. System verifies ownership ]
        |
        v
[ 4. System generates download URL ]
        |
        v
[ 5. Buyer downloads file ]
```

---

### Step 1 — Load purchases

| What can go wrong | Test |
|---|---|
| Buyer has no purchases | `returns an empty array when the buyer has no purchases` |
| Internal fields leak to the client (cloudinaryPublicId) | `returns mapped purchases for the buyer` (exact toEqual catches extra fields) |

---

### Step 3 — Verify ownership

Three separate entry points — authenticated buyer, token-based guest, orderId-based guest.

| Entry point | What can go wrong | Test |
|---|---|---|
| Authenticated | purchaseId belongs to a different buyer | `throws ForbiddenError when purchase does not belong to this buyer` |
| Token | Token is invalid or expired | `throws ForbiddenError when token is invalid or not found` |
| Guest orderId | purchaseId doesn't belong to the given orderId | `throws ForbiddenError when purchaseId does not belong to the given orderId` |

---

### Step 4 — Generate download URL

The download source depends on how the media was originally uploaded.

```
Purchase found
      |
      +-- importSource = DIRECT ------> Cloudinary signed URL
      |                                 (file lives in Cloudinary)
      |
      +-- importSource = GOOGLE_DRIVE -> importer.importForDownload
                                         (file lives in Drive, fetched on demand)
```

| What can go wrong | Test |
|---|---|
| DIRECT item routes to wrong provider | `calls cloudinary.generateSignedDownload for DIRECT purchases` + `importer.importForDownload not called` |
| Drive item routes to wrong provider | `calls importer.importForDownload for GOOGLE_DRIVE purchases` + `cloudinary not called` |

---

## Why the tests are split into separate `describe` blocks

```
CheckoutService.createCheckoutSession   <- covers Journey 1
CheckoutService.getPurchases            <- covers Journey 2, Step 1
CheckoutService.generateDownloadAccess  <- covers Journey 2, Steps 3-4 (authenticated)
CheckoutService.generateDownloadAccessByToken  <- same, token-based
CheckoutService.getGuestDownloadAccess  <- same, orderId-based
CheckoutService — Drive availability check  <- Step 2 Drive cases, via createCheckoutSession
CheckoutService — resolveDownload dispatch  <- Step 4 routing, via generateDownloadAccess
```

Each `describe` = one method or one concern within a method.
Each `it` = one contract from the tables above.
