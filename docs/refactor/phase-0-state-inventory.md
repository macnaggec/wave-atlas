# Phase 0 — State Inventory & Coupling Audit

**Status:** READ-ONLY audit. No source files were changed. Every claim cites the
file + line range it was read from. Where a fact could not be found, it is marked
`NOT FOUND`. Classifications and inferences are labelled as **PROPOSAL**, not fact.

**Scope read (all files read in full unless noted):**
`src/app/routes/*` (every file), `src/app/AppShell.tsx`,
`src/views/GlobeScene/GlobeScene.tsx`, `src/widgets/SidePanel/*`,
`src/widgets/GlobeMap/model/{mapStore,mapCommands,CameraService,useSpotCard}.ts`,
`src/widgets/GlobeMap/GlobeMapComponent.tsx`,
`src/widgets/GlobeMap/{hooks/usePinPlacementMode,ui/TempPinMarker}`,
`src/widgets/LeftStrip/*`, `src/widgets/FeedDrawer/FeedSearch.tsx`,
`src/features/AddSpot/{AddSpotProvider,AddSpotModalProvider,model/useAddSpotFlow}`,
plus follow-the-import grep sweeps for every store field and command.

---

## 0. The single most important structural finding

There are **two parallel, largely independent "spot detail" UI systems** in this app,
and they store the same conceptual fact ("which spot the user is looking at") in two
unrelated mechanisms:

1. **The AppShell SidePanel** (right-edge glass panel) — driven entirely by
   `mapStore.selection` (a `Spot` object) plus **nine `useState` flags inside
   `AppShell.tsx`** (`AppShell.tsx:105-113`). This is the path a user actually
   travels: marker click / search → `selection` set → panel shows sessions →
   click session → media grid. **None of this is in the URL.**

2. **The TanStack Router `_drawer.$spotId` Mantine Drawer** — driven by the URL path
   param `$spotId` (`_drawer.$spotId.tsx:7,12`), rendering `PublicGallery` / cart.
   This drawer is **only reachable from two places**: after creating a spot
   (`useAddSpotFlow.ts:98,147`) and the cart "back" button
   (`_drawer.cart.tsx:34`). No marker click, search result, session card, or
   gallery card navigates to it (grep for `useNavigate`/`<Link>` in
   `src/widgets/SidePanel`, `src/features/PublicGallery`, `src/entities` returns
   **none**).

The only bridge between the two systems is an effect at
`GlobeMapComponent.tsx:129-134`: when a `$spotId` URL is active it calls
`mapCommands.onPanelOpen()` which **clears** `mapStore.selection`
(`mapCommands.ts:22-25`). So the two systems are kept mutually exclusive by a
one-way effect, not unified.

**PROPOSAL:** This is the core of what the refactor must resolve — the SidePanel's
local-state machine is the navigation-worthy destination that currently has no URL,
while the route-driven drawer is a near-orphaned legacy path.

---

## 1. State inventory table

Legend for **Proposed classification** (PROPOSAL in every row):
- **NAVIGATIONAL** — a user would reasonably expect back/forward, a deep link, or a
  refresh to land here.
- **EPHEMERAL_UI** — transient view chrome; losing it on refresh is fine.
- **MAP_DOMAIN** — belongs in the map store regardless of URL strategy.

### 1a. AppShell component state (`useState` in `src/app/AppShell.tsx`)

| Name | Where it lives | Mechanism | Who writes it | Who reads it | Duplicated? | Proposed classification + reasoning |
|---|---|---|---|---|---|---|
| `panelOpen` | `AppShell.tsx:105` | `useState(true)` | `setPanelOpen` at `AppShell.tsx:124` (auto-open on selection), `:144` (`handleOpen`), `:145` (`handleClose`), `:150` (`handleOpenCollection`) | `AppShell.tsx:120` (synced to store), `:234` (filter pill gate), `:249` (`SidePanel isOpen`) | **YES** — mirrored into `mapStore.isSidePanelOpen` via effect at `AppShell.tsx:120`. Twin: `isSidePanelOpen` (row 2a). | **NAVIGATIONAL** — whether the panel is open is a primary view state a deep link / refresh should restore. |
| `feedExpanded` | `AppShell.tsx:106` | `useState(false)` | `:152,153` (collection), `:155` (`handleExpandToggle`), `:166` (upload), `:192` (session click), `:198` (see-all), `:253` (collection back restores from `prevExpandedRef`) | `:140` (`expanded`), `:148` (`prevExpandedRef`), `:224` (globe `inert`), `:234`, `:254`, `:299`, `:322`, `:356` | Conceptually overlaps dead `mapStore.sidebarExpanded` (row 2g) but **not synced** — see Open Question Q1. | **NAVIGATIONAL** (PROPOSAL, weak) — expanded vs compact panel is arguably deep-linkable; could also be EPHEMERAL_UI. Flagged for human (Q1). |
| `collectionMode` | `AppShell.tsx:107` | `useState(false)` | `:149` (`handleOpenCollection` → true), `:253` (`onBack` → false) | `:141,220,254,257,281,333,336,353` | Conceptually duplicates routed `/me` collection (see §2 Dup #4). Not synced. | **NAVIGATIONAL** — "My Collection" is a distinct destination; today it has no URL while a routed `/me` also exists. |
| `uploadMode` | `AppShell.tsx:108` | `useState(false)` | `:151` (collection clears), `:165` (`handleUploadClick`), `:181` (cancel) | `:138,139,141,254,259,283,336,338,353` | none | **NAVIGATIONAL** — upload is a distinct task/destination; refresh-survival & back-button are expected. |
| `uploadSpot` | `AppShell.tsx:109` | `useState<Spot\|null>(null)` | `:164` (from `selection`), `:173` (`handleUploadSpotSelect`), `:177` (clear), `:186` (cancel) | `:285,286,287,337,338` | Seeded from `mapStore.selection` at `:164` (snapshot copy, then diverges). | **NAVIGATIONAL** (PROPOSAL) — the spot being uploaded to is deep-link-worthy as `?uploadSpot=` or path segment. |
| `selectedSession` | `AppShell.tsx:110` | `useState<SurfSessionItem\|null>(null)` | `:132` (reset on deselect), `:167,185` (clear), `:190` (`handleSessionClick`), `:196,203` (see-all/sessions) | `:138,139,261,272,365,366` | none | **NAVIGATIONAL** — viewing one session's media is a deep-linkable detail view. |
| `galleryOpen` | `AppShell.tsx:111` | `useState(false)` | `:131` (reset), `:167,184` (clear), `:197` (see-all), `:202` (see-sessions) | `:138` (`isCAll`) | Overlaps `galleryScope` (next row) — both encode the sessions-vs-gallery split. | **NAVIGATIONAL** — gallery vs sessions scope is a deep-linkable sub-view. |
| `galleryScope` | `AppShell.tsx:112` | `useState<'sessions'\|'gallery'>('sessions')` | `:133` (reset), `:186` (cancel), `:191` (session click→'gallery'), `:199` (see-all→'gallery'), `:204` (see-sessions), `:209` (`handleScopeChange`) | `:277` (`ScopeSwitcher scope`) | **Partial twin of `galleryOpen`** — `handleSeeAll`/`handleSeeSessions` set both together (`:197-199`, `:202-204`). | **NAVIGATIONAL** — same reasoning as `galleryOpen`; likely these two should collapse to one URL segment. |
| `activeFilter` | `AppShell.tsx:113` | `useState<ActiveFilter>(null)` | `setActiveFilter` via `FilterPills onChange` at `:244,324` | `:141`(`showFilter`), `:244,324` (pills), `:356` (`SessionFeed activeFilter`) → `SessionFeed.tsx:95` `toDateRange` | none | **NAVIGATIONAL** — a date filter (today/yesterday/last7/custom) is exactly the kind of thing a shareable URL should carry. |
| `prevExpandedRef` | `AppShell.tsx:114` | `useRef(false)` | `:148` (saves `feedExpanded` before collection) | `:253` (restores on collection back) | Shadow copy of `feedExpanded` for undo. | **EPHEMERAL_UI** — pure undo scratchpad for one interaction; not a destination. |
| `open` (FilterPills) | `AppShell.tsx:50` | `useState(false)` | `:70,72,83` | `:70,72` (Popover) | none | **EPHEMERAL_UI** — popover open/closed. |

### 1b. mapStore zustand fields (`src/widgets/GlobeMap/model/mapStore.ts`)

| Name | Where it lives | Mechanism | Who writes it | Who reads it | Duplicated? | Proposed classification + reasoning |
|---|---|---|---|---|---|---|
| `selection` | decl `mapStore.ts:25`, init `:56` | zustand field | `setSelection` (`:64`) called by `mapCommands.selectFromSearch/selectFromPin` (`mapCommands.ts:7,12`) + `AppShell.tsx:160`; `clearSelection` (`:65`) called by `mapCommands.clearAll/onPanelOpen` (`mapCommands.ts:18,24`) | `AppShell.tsx:116`, `SessionFeed.tsx:93`, `GlobeMapComponent.tsx:60`, `FeedSearch.tsx:23` | Seeds `AppShell.uploadSpot` (`AppShell.tsx:164`). Cleared by `$spotId` URL effect (`GlobeMapComponent.tsx:133`). | **NAVIGATIONAL** (PROPOSAL) — the selected spot is the single most deep-link-worthy fact; today it lives only in the store and is wiped by the parallel URL drawer. |
| `isSidePanelOpen` | decl `:26`, init `:57` | zustand field | `setSidePanelOpen` (`:66`) — only caller is `AppShell.tsx:120` effect | **NO READER FOUND** — grep for `isSidePanelOpen` returns only `mapStore.ts:26,57,66`. Write-only. | Twin of `AppShell.panelOpen` (write target of the sync). | **EPHEMERAL_UI / DEAD** — see §5. It duplicates `panelOpen` but is never read; the sync at `AppShell.tsx:120` feeds nothing. |
| `cameraState` | decl `:27`, init `:58` (`DEFAULT_CAMERA`) | zustand field, **persisted** (`partialize` `:82`, sessionStorage `:80`) | `saveCameraState` (`:67`) called by `GlobeMapComponent.tsx:142` (`onMoveEnd`) | `GlobeMapComponent.tsx:62,75,76,89` (initial view resolution) | none | **MAP_DOMAIN** — camera lng/lat/zoom is intrinsic map state; already persisted to sessionStorage. (Could *also* be URL-synced, but belongs in store.) |
| `interactionMode` | decl `:28` (`'explore'\|'pin-placement'\|'spot-select'`), init `:59` | zustand field | `enterPinPlacement` (`:68`), `exitPinPlacement` (`:70`), `enterSpotSelect` (`:72`), `exitSpotSelect` (`:73`) | `GlobeScene.tsx:15`, `GlobeMapComponent.tsx:65,66`, `TempPinMarker.tsx:7` | none | **MAP_DOMAIN** — drives map cursor/layers/spin. Note `'spot-select'` value is dead (§5). |
| `tempPin` | decl `:30`, init `:60` | zustand field | `setTempPin` (`:74`) ← `usePinPlacementMode.ts:11,14`; cleared by `clearTempPin` (`:75`) + enter/exit pin placement (`:69,71`) | `useAddSpotFlow.ts:42,65,82,87,88,121,130`, `TempPinMarker.tsx:6` | none | **MAP_DOMAIN** — transient map-canvas coordinate during add-spot; not a destination. |
| `pendingSpotName` | decl `:32`, init `:61` | zustand field | set by `enterPinPlacement` (`:69`); cleared by `exitPinPlacement` (`:71`) | `useAddSpotFlow.ts:43,49` (seeds form `name`) | none | **EPHEMERAL_UI** — hand-off of the search query into the add-spot form; consumed once. |
| `sidebarExpanded` | decl `:34`, init `:62` | zustand field | `setSidebarExpanded` (`:76`) — **no caller** (grep returns only `mapStore.ts:34,48,62,76`) | **NO READER FOUND** | Conceptual twin of `AppShell.feedExpanded`, but **never synced and never used**. | **DEAD** (§5). Intent was presumably to be the store-side of `feedExpanded`; never wired. |

### 1c. Route-derived & route-local state

| Name | Where it lives | Mechanism | Who writes it | Who reads it | Duplicated? | Proposed classification |
|---|---|---|---|---|---|---|
| `$spotId` | `_drawer.$spotId.tsx:7,12`; `_drawer.$spotId.index.tsx:9,14` | route **path param** | URL nav: `useAddSpotFlow.ts:98,147`, `_drawer.cart.tsx:34` | `_drawer.$spotId.tsx:12`, `.index.tsx:14`, `CartControl.tsx:19`, `GlobeMapComponent.tsx:130` | Parallel to `mapStore.selection` (see §0/§2). | **NAVIGATIONAL** (already a URL). |
| cart `from` | `_drawer.cart.tsx:17,24` | route **search param** (`validateSearch`) | `CartButton.tsx:18`, `CartControl.tsx:33` | `_drawer.cart.tsx:28,33,34,52,54` | none | **NAVIGATIONAL** (already a URL). |
| `/me` `activeTab` | `_drawer.me.tsx:23` | derived from URL via `useTabNavigation(TAB_ROUTES)` | tab change → `handleTabChange` (`_drawer.me.tsx:31`) | `_drawer.me.tsx:31` | none | **NAVIGATIONAL** (already URL-driven). |
| `isDrawerRoute` | `__root.tsx:30-32` | **derived** from `useRouterState` matches | router | `__root.tsx:54,63,67` (Drawer open + Outlet placement) | none | **NAVIGATIONAL** (derived from URL). |
| `panelOpen` (map) | `GlobeMapComponent.tsx:129-131` | **derived** from router matches (`spotId` in params) | router | `GlobeMapComponent.tsx:133` effect → `mapCommands.onPanelOpen()` | Distinct from `AppShell.panelOpen` despite the name collision — see Open Question Q2. | **NAVIGATIONAL** (derived). |
| `appReady` | `__root.tsx:34` | `useState(false)` | `__root.tsx:39` | `__root.tsx:59` (disable transition on first paint) | none | **EPHEMERAL_UI**. |
| `closing` | `__root.tsx:35` | `useState(false)` | `:41` (`handleClose`), `:44` (`handleExited`) | `:54` (Drawer `opened`) | none | **EPHEMERAL_UI** (drawer close animation latch). |
| `lightboxItem` | `_drawer.cart.tsx:31` | `useState<CartItem\|null>` | `:42,79` | `:77` | none | **EPHEMERAL_UI** (lightbox). |
| `spotFilter` | `_drawer.me.index.tsx:79` | `useState<string\|null>` | `:119` | `:89-91,118` | none | **EPHEMERAL_UI** (PROPOSAL; could be `?spot=` deep link, low value). |
| add-spot flow (`step`,`name`,`location`,`nearbySpots`,errors,`isCheckingNearby`) | `useAddSpotFlow.ts:48-53` | `useState` | throughout `useAddSpotFlow.ts` | add-spot UI steps | `name` seeded from `pendingSpotName` (`:49`); `tempPin`/`pendingSpotName` come from store | **EPHEMERAL_UI** — multi-step form scratch state. |

> Cart store (`features/Cart/model/cartStore`), auth/user state, and TanStack Query
> server caches were treated as out of scope for the navigation refactor and are not
> itemised here beyond their interactions noted above. Flag if Phase 1 needs them.

---

## 2. Duplication report (highest priority)

**Dup #1 — `panelOpen` ⇄ `isSidePanelOpen` (one-way, dead target).**
`AppShell.tsx:120`:
```ts
useEffect(() => { setSidePanelOpen(panelOpen); }, [panelOpen, setSidePanelOpen]);
```
Source of truth: `AppShell.panelOpen` (`AppShell.tsx:105`). Mirror:
`mapStore.isSidePanelOpen` (`mapStore.ts:26`). **The mirror has no reader** (grep
for `isSidePanelOpen` returns only its three definition lines). → The sync exists but
feeds nothing; effectively dead duplication.

**Dup #2 — `mapStore.selection` ⇄ `$spotId` route param.**
Two storage mechanisms for "the spot in focus." `selection` drives the SidePanel
(`AppShell.tsx:116`, `SessionFeed.tsx:93`, `GlobeMapComponent.tsx:60`,
`FeedSearch.tsx:23`); `$spotId` drives the routed drawer
(`_drawer.$spotId.tsx:12`). Sync mechanism: **one-way clear** — when a `$spotId`
URL is active, `GlobeMapComponent.tsx:132-134` runs `mapCommands.onPanelOpen()`
which calls `clearSelection()` (`mapCommands.ts:23-25`). There is no reverse sync
(selecting a spot does **not** navigate to `/$spotId`).

**Dup #3 — `galleryOpen` ⇄ `galleryScope`.**
Both in `AppShell.tsx` (`:111`, `:112`). They encode the same sessions-vs-gallery
split and are written together: `handleSeeAll` sets `galleryOpen=true` +
`galleryScope='gallery'` (`:197-199`); `handleSeeSessions` sets `galleryOpen=false`
+ `galleryScope='sessions'` (`:202-204`); `handleSessionClick` sets
`galleryScope='gallery'` without touching `galleryOpen` (`:191`). Sync is manual and
hand-written per handler (no effect). **PROPOSAL:** collapse to one enum.

**Dup #4 — "My Collection" exists as both local state and a route.**
`AppShell.collectionMode` (`AppShell.tsx:107`) → renders `<MyCollection/>`
(`AppShell.tsx:333`), reached via `UserControl.tsx:60` "My Collection" menu item →
`onOpenCollection` → `handleOpenCollection` (`AppShell.tsx:147`). **Separately**, a
routed `/me` drawer (`_drawer.me.tsx`) with uploads/purchases/favorites tabs also
represents the user's collection. The menu item does **not** navigate to `/me`; the
two are unsynced parallel implementations of the same concept. (No sync code.)

**Dup #5 — `feedExpanded` (local) vs `sidebarExpanded` (store, dead).**
`AppShell.feedExpanded` (`:106`) is the live "panel is wide" flag. `mapStore.sidebarExpanded`
(`mapStore.ts:34`) is the apparently-intended store-side twin but is **never written
or read** outside its declaration. No sync. See Open Question Q1.

**Dup #6 — `uploadSpot` seeded from `selection`.**
`AppShell.tsx:164` `setUploadSpot(selection)` snapshots the store selection into local
state at upload-start, after which they diverge (upload search can change `uploadSpot`
independently via `:173`). Not a live sync — a one-time copy.

---

## 3. Map ↔ panel coupling map

### Selecting a spot → map
- **Marker / cluster click → selection + camera.** `useMapInteraction`
  (`GlobeMapComponent.tsx:114-126`) wires `onSpotClick: (spot) =>
  mapCommands.selectFromPin(spot)` (`:123`). `selectFromPin` (`mapCommands.ts:11-14`)
  sets store selection **and** `cameraService.flyTo(spot, false)`.
  **Direction:** map event → command → store + camera service.
- **Background map click → clear.** `onClearSelection: () => mapCommands.clearAll()`
  (`GlobeMapComponent.tsx:124`); `clearAll` (`mapCommands.ts:16-20`) clears selection
  + `cameraService.resetPadding()`. **Direction:** map event → command → store + camera.
- **Search select → selection + camera.** `FeedSearch.tsx:29-35` →
  `mapCommands.selectFromSearch` (`mapCommands.ts:6-9`) → store + `flyTo`.
  **Direction:** component → command → store + camera.
- **Search select while panel expanded → selection only (no fly).**
  `AppShell.tsx:159-161` `handleSearchSelectNoFly` calls
  `useMapStore.getState().setSelection(spot)` directly (no camera). Wired in via
  `FeedSearch onSpotSelect={expanded ? handleSearchSelectNoFly : undefined}`
  (`AppShell.tsx:302`). **Direction:** component → store (camera deliberately skipped).
- **Active spot → map layer styling.** `activeSpotId` (`GlobeMapComponent.tsx:61`)
  feeds `getUnclusteredPointLayer`/`getIconLayer` (`:102-109`) and the cursor (`:162`)
  and suppresses the hover popup for the active spot (`:203`). **Direction:** store → map render.

### Map → panel
- **Selection drives panel open + content.** `AppShell.tsx:116` reads `selection`;
  effect `:123-125` **auto-opens** the panel when a spot is selected
  (`if (selection) setPanelOpen(true)`); effect `:128-134` **resets** gallery/session
  state when `selection` becomes null. **Direction:** store → component (effect-synced).
  ⚠️ This is an **effect-driven coupling** from map-domain state into panel UI state.
- **Selection drives session query scope.** `SessionFeed.tsx:93` reads
  `selection?.id` and passes it as `spotId` to the sessions query (`:101`).
  **Direction:** store → component.

### Panel open/expanded → map
- **Expanded panel makes the globe inert.** `AppShell.tsx:224`
  `<div inert={expanded || undefined}><GlobeScene/></div>` — when `feedExpanded` is
  true the whole map subtree is `inert`. **Direction:** component state → DOM attribute
  on map container. (One-way, render-time; not via store.)
- **`panelOpen` mirrored to store but unused.** `AppShell.tsx:120` writes
  `isSidePanelOpen`; **no map code reads it** (§2 Dup #1). So today panel-open does
  **not** actually affect the map. **Direction:** component → store → (dead end).
- **`$spotId` URL → clears map selection.** `GlobeMapComponent.tsx:132-134` effect
  on derived `panelOpen` calls `mapCommands.onPanelOpen()` → `clearSelection()`.
  **Direction:** route → command → store. This is the only live route→map coupling.
- **Camera padding hook (mostly inert now).** `CameraService.flyTo` accepts
  `showPreview` to pad the top of the viewport (`CameraService.ts:42`,
  `top: 300` vs `top: 0`), and `resetPadding()` (`:30-37`) zeroes it. But every live
  caller passes `showPreview = false` (`mapCommands.ts:8,13`), so the panel no longer
  pushes the camera. The `{ top: 300 }` branch is **reachable only via the default
  param** (`CameraService.ts:22` `showPreview = true`), which nothing triggers. Flag as
  near-dead (§5).

### Bidirectional / effect-synced couplings (explicitly flagged)
- `selection` ⇆ `panelOpen`: map-domain `selection` **writes** UI `panelOpen` via
  effect (`AppShell.tsx:123-125`); separately `panelOpen` is mirrored back into the
  store as the dead `isSidePanelOpen`. Net: an effect loop scaffold where only one
  direction does anything.
- `selection` ⇆ `$spotId`: store→route is **absent** (no nav on select); route→store
  is a **clear** (`onPanelOpen`). Asymmetric by design, easy to desync.

---

## 4. Existing routing structure

File-based tree (`src/app/routes/`, confirmed against `routeTree.gen.ts` presence):

| Route id / path | File | Renders | Layout kind | Notes |
|---|---|---|---|---|
| `/` | `index.tsx` | `() => null` | leaf | Globe is drawn by root layout; this route renders nothing (`index.tsx:4-6`). |
| `/_drawer` | `_drawer.tsx` | `DrawerLayoutPanel` passthrough | **pathless layout** | `Drawer.Root` itself is owned by `__root.tsx:53-65`, never unmounts. |
| `/_drawer/$spotId` | `_drawer.$spotId.tsx` | Drawer header (spot name) + `<Outlet/>` + `CartButton` | child of drawer | Spot detail. **Reached only via add-spot + cart-back** (§0). |
| `/_drawer/$spotId/` | `_drawer.$spotId.index.tsx` | `PublicGallery` | index child | The public spot gallery (cart-add). |
| `/_drawer/cart` | `_drawer.cart.tsx` | Cart drawer (`BaseGallery` of cart items) | child of drawer | Search param `from` (`:17`). Reached via `CartButton`/`CartControl`. |
| `/_drawer/me` | `_drawer.me.tsx` | `MeLayout` (3 tabs) | child of drawer | URL-driven tabs via `useTabNavigation`. |
| `/_drawer/me/` | `_drawer.me.index.tsx` | `UploadsTab` (my sessions) | index child | Reachable only by tabbing once inside `/me/*`. |
| `/_drawer/me/purchases` | `_drawer.me.purchases.tsx` | purchases | child | **Only direct entry point** to `/me/*` from UI: `order-success.tsx:29` `<Link to="/me/purchases">`. |
| `/_drawer/me/favorites` | `_drawer.me.favorites.tsx` | placeholder ("favorites will appear here") | child | Stub (`favorites.tsx:11-17`). |
| `/_page` | `_page.tsx` | full-screen overlay box + `<Outlet/>` | **pathless layout** | Fixed overlay above globe (`_page.tsx:17-22`). |
| `/_page/account` | `_page.account.tsx` | "Account Settings — coming soon" | child | Stub. Reached via `UserControl.tsx:26`. |
| `/_page/order-success` | `_page.order-success.tsx` | payment success | child | Post-CryptoCloud redirect. |
| `/auth` | `auth.tsx` | `null` (redirects to `/` + opens modal) | leaf | `auth.tsx:19-24`. |

**Renders inside the Mantine Drawer (`_drawer` tree):** `$spotId`, `$spotId/`,
`cart`, `me`, `me/`, `me/purchases`, `me/favorites`. The Drawer `opened` prop is
`isDrawerRoute && !closing` (`__root.tsx:54`), where `isDrawerRoute` =
"any match has routeId `/_drawer`" (`__root.tsx:30-32`).

**Renders as overlay (`_page` tree):** `account`, `order-success` (fixed full-screen
box, `_page.tsx`).

**Distinct destinations with NO route (state-only):**
- **Collection** — lives as `AppShell.collectionMode` local state (§2 Dup #4),
  despite a parallel routed `/me` existing.
- **Upload** — `AppShell.uploadMode` (`AppShell.tsx:108`); no URL.
- **Selected spot (SidePanel context)** — `mapStore.selection`; the *panel's* notion
  of a selected spot is never in the URL (only the orphaned `$spotId` drawer is).
- **Selected session / gallery scope / active date filter** —
  `selectedSession`, `galleryOpen`, `galleryScope`, `activeFilter`
  (`AppShell.tsx:110-113`); none routed.

---

## 5. Dead / orphaned code (evidence = the absence)

1. **`mapStore.sidebarExpanded` + `setSidebarExpanded` — fully dead.**
   `grep -rn "sidebarExpanded\|setSidebarExpanded" src` returns **only**
   `mapStore.ts:34,48,62,76` (declaration, action type, init, setter). No writer, no
   reader. → safe to delete; note for refactor (do not delete in Phase 0).

2. **`mapStore.isSidePanelOpen` — write-only (dead read side).**
   `grep -rn "isSidePanelOpen" src` returns only `mapStore.ts:26,57,66`. It is written
   by the `AppShell.tsx:120` sync but never read. The setter `setSidePanelOpen` has
   exactly one caller (that sync). → the field + its sync are effectively dead.

3. **`InteractionMode === 'spot-select'` + `enterSpotSelect`/`exitSpotSelect` — dead.**
   `grep -rn "enterSpotSelect\|exitSpotSelect" src` outside `mapStore.ts` → none.
   `grep -rn "spot-select" src` → only `mapStore.ts:22` (type) and `:72` (setter).
   The `'spot-select'` interaction mode is defined but never entered or checked.

4. **`AddSpotModalProvider.tsx` — orphaned file.**
   It exports a function **also named** `AddSpotProvider`
   (`AddSpotModalProvider.tsx:15`), but `features/AddSpot/index.ts:1` re-exports from
   `./AddSpotProvider`, and `__root.tsx:9` imports from `features/AddSpot`. `grep -rn
   "AddSpotModalProvider" src` returns only the file itself. → orphaned duplicate of
   `AddSpotProvider.tsx`.

5. **`ModeSwitcher` component — orphaned.**
   `grep -rn "<ModeSwitcher" src` → none. `ModeSwitcher` appears only in its own
   definition (`ModeSwitcher.tsx:8`) and a JSDoc mention (`SidePanel.tsx:17`).
   `ScopeSwitcher.tsx:1` imports the shared CSS module `./ModeSwitcher.module.css`,
   **not** the component. → the `ModeSwitcher.tsx` component is unused (its CSS is not).

6. **`CameraService` preview-padding path — near-dead.**
   The `{ top: 300 }` padding branch (`CameraService.ts:42`) only triggers when
   `showPreview` is true, but both live callers pass `false`
   (`mapCommands.ts:8,13`) and no caller relies on the `showPreview = true` default
   (`CameraService.ts:22`). The padding/`resetPadding` machinery is retained but no
   longer pushes the camera for the panel.

7. **`SidePanel` `topAction` prop — unused by the only consumer.**
   `SidePanel` defines `topAction` (`SidePanel.tsx:19,77`) but `AppShell.tsx:248-331`
   (the sole `<SidePanel>` usage) never passes it. Low priority; mention only.

8. **`useSpotCard` hook — orphaned.**
   `grep -rn "useSpotCard" src` returns **only** its definition
   (`GlobeMap/model/useSpotCard.ts:5`). No caller. → unused export
   (it queries `trpc.spots.card`; the globe popup now renders from `hoveredSpot`
   in `GlobeMapComponent.tsx:203-216`, not this hook).

---

## 6. Open questions for the human (must resolve before Phase 1)

- **Q1.** Is `AppShell.feedExpanded` (`AppShell.tsx:106`) meant to be the same concept
  as the dead `mapStore.sidebarExpanded` (`mapStore.ts:34`)? If yes, was the store
  field abandoned (delete it) or never finished (the intended home for the URL/store
  expanded flag)?

- **Q2.** Two different things are both called `panelOpen`: `AppShell.panelOpen`
  (the right SidePanel open/closed, `AppShell.tsx:105`) and the derived
  `panelOpen` in `GlobeMapComponent.tsx:129` (true when a `$spotId` *route* is active).
  Are these intended to be one concept, or permanently distinct? The naming collision
  will mislead the refactor.

- **Q3.** Should the routed `_drawer.$spotId` drawer (PublicGallery/cart) and the
  AppShell SidePanel spot view be **unified** (one spot-detail surface driven by the
  URL), or do they intentionally serve different audiences (public gallery vs.
  session-centric panel)? Today only add-spot and cart-back reach the drawer.

- **Q4.** Should "My Collection" be the routed `/me` drawer or the local
  `collectionMode` SidePanel (§2 Dup #4)? They are two implementations of one
  destination; the refactor needs one source of truth.

- **Q5.** For the NAVIGATIONAL classifications in §1a (`uploadMode`, `uploadSpot`,
  `selectedSession`, `galleryOpen`/`galleryScope`, `activeFilter`): which of these
  should actually get URL segments/search params vs. stay ephemeral? My proposals are
  reasoning-based, not product decisions — confirm the intended deep-link surface.

- **Q6.** `cameraState` is `MAP_DOMAIN` and already persisted to `sessionStorage`
  (`mapStore.ts:80-82`). Should camera position *also* be reflected in the URL
  (shareable map view), or remain store/session only?

- **Q7.** Confirm scope: should the navigation refactor touch `auth`, cart, and the
  `/me` tabs (already URL-driven), or only migrate the AppShell local-state machine
  into the URL while leaving the existing routes as-is?

---

## 7. Resolved decisions (human-confirmed) — binding for Phases 1–4

> This section was added after human review. Where it conflicts with a
> **PROPOSAL** in §1–§6, **this section wins.** Later-phase prompts cite this
> section as the spec. Each entry resolves an Open Question (§6) or corrects a
> classification cell (§1).

### 7.0 Verified coupling (spot-check before writing)
`GlobeMapComponent.tsx:128–133` confirmed read directly:
```ts
const panelOpen = useRouterState({
  select: (s) => s.matches.some((m) => 'spotId' in (m.params ?? {})),
});
useEffect(() => {
  if (panelOpen) mapCommands.onPanelOpen();   // → clearSelection()
}, [panelOpen]);
```
§2 Dup #2 and §3 are **accurate**. Nuance: the effect fires on the
false→true transition of "a `spotId` route is active" and calls
`clearSelection()`. **Phase 3 consequence:** this effect actively erases the
selection that the route is meant to drive. It MUST be deleted in the *same
commit* that introduces route→store selection sync, or selection blanks on
every spot navigation. Highest-priority deletion in Phase 3.

### 7.1 Classification corrections (override §1)
- **`panelOpen` (`AppShell.tsx:105`) — NOT navigational. Reclassify: ELIMINATED.**
  Overrides §1a row 1 (which proposed NAVIGATIONAL). Rationale: "panel open vs
  closed" is not a destination. Once spot / collection / upload are routes,
  "panel is open" becomes *derivable* from "an active panel route is matched,"
  not a stored boolean. The field stops existing rather than moving to the URL.
  Phase 1 deletes the `panelOpen`↔`isSidePanelOpen` sync (§2 Dup #1); Phase 2/3
  replace reads of `panelOpen` with a router-derived `hasActivePanelRoute`.
- **`activeFilter` (`AppShell.tsx:113`) — classification is a PRODUCT decision, left
  OPEN, default EPHEMERAL_UI for now.** Overrides the confident NAVIGATIONAL cell
  in §1a. It becomes a search param only if/when shareable filtered feeds are a
  desired product feature (see Q5). Until then it stays local `useState`. Do not
  route it in Phases 1–4 unless the product decision flips.

### 7.2 Q1 — `feedExpanded` vs dead `mapStore.sidebarExpanded`
**DELETE `sidebarExpanded` + `setSidebarExpanded` (`mapStore.ts:34,48,62,76`).**
It was never wired (§5 #1); treat as abandoned, not as the intended home for an
expanded flag. `feedExpanded` stays local `useState` (ephemeral view chrome) for
Phases 1–3. Making expanded URL-restorable is deferred to **Phase 4**, and when
done it is a *search-param modifier on a destination route*, not a revival of
`sidebarExpanded`.

### 7.3 Q2 — `panelOpen` naming collision (do this FIRST, pre-refactor)
Two unrelated concepts share the name `panelOpen`:
`AppShell.panelOpen` (UI boolean) and the derived `panelOpen` in
`GlobeMapComponent.tsx:129` (router-derived "a spotId route is active").
**Action, before any Phase 1 edit:** rename the `GlobeMapComponent` derived value
to `hasSpotRoute` (or `isSpotRouteActive`). Pure rename, zero behaviour change,
removes a collision that will otherwise mislead every later phase. Per §7.1,
`AppShell.panelOpen` is then eliminated entirely.

### 7.4 Q3 — unify spot-detail surfaces onto the URL panel; retire the drawer
The `_drawer.$spotId` Mantine Drawer is near-orphaned (reachable only from
add-spot completion `useAddSpotFlow.ts:98,147` and cart-back `_drawer.cart.tsx:34`
— §0). **Decision: unify onto the URL-driven SidePanel; retire the drawer.** Do
not preserve two audiences. The session-centric SidePanel becomes the single
spot-detail surface, driven by `/_panel/spot/$spotId`. `PublicGallery` content
moves into that panel surface. Phase 2 deletes `Drawer.Root` (`__root.tsx`) and
the `_drawer` tree; Phase 3 re-points add-spot and cart-back navigation at the
new `/_panel/spot/$spotId` route.

### 7.5 Q4 — "My Collection": the routed destination wins
`AppShell.collectionMode` local state (§2 Dup #4) is replaced by navigation to the
routed collection (`/me` family, re-homed under `_panel`). The "My Collection"
menu item (`UserControl.tsx:60`) changes from `onOpenCollection`/
`handleOpenCollection` to `navigate({ to: '/me' })`. `collectionMode`,
`handleOpenCollection`, and the `prevExpandedRef` undo tied to it are removed in
Phase 3.

### 7.6 Q6 — camera stays out of the URL (for now)
`cameraState` remains `MAP_DOMAIN`, store + sessionStorage only
(`mapStore.ts:80–82`). Shareable-map-view URLs are a separate feature with their
own UX questions; explicitly out of scope for this refactor. Do not URL-sync the
camera in Phases 1–4.

### 7.7 Q7 — scope of churn to existing routes
Leave already-routed surfaces (`cart`, `me/*`, `auth`) **structurally** intact;
only **re-home** them from the `_drawer` pathless layout to the new `_panel`
pathless layout (path/import changes, not logic rewrites). The refactor's real
work is migrating the `AppShell` local-state machine
(`collectionMode`, `uploadMode`, `selectedSession`, `galleryOpen`/`galleryScope`,
spot selection) into the URL — not rewriting the cart or me-tabs internals.

### 7.8 Dead code — confirmed for removal during the phases (not in Phase 0)
Per §5, the following are confirmed safe to delete *as the relevant phase touches
them* (not pre-emptively): `mapStore.sidebarExpanded`/`setSidebarExpanded` (§7.2);
`mapStore.isSidePanelOpen`/`setSidePanelOpen` + its sync (§7.1, §7.3);
`InteractionMode 'spot-select'` + `enterSpotSelect`/`exitSpotSelect` (§5 #3);
`AddSpotModalProvider.tsx` (§5 #4); `ModeSwitcher.tsx` component, keeping its CSS
module (§5 #5); `useSpotCard.ts` (§5 #8). `CameraService` preview-padding (§5 #6)
and `SidePanel.topAction` (§5 #7) are noted low-priority; leave unless a phase
naturally removes them.
