# Wave Atlas — UX Redesign Plan

## Vision

Shift Wave Atlas from a map with spot-based photo galleries into a surf discovery platform:

- A globe that shows **where surf is being photographed right now**
- A **persistent feed panel** showing recent sessions
- **Sessions** (one photographer + one spot + one day) as the primary content unit
- **Seamless dual-role UX** — every user can browse and upload, no role assignment

Competitors (SurfCloud, SeeYouSurf) have a session feed. None have a globe. The combination is the differentiator.

---

## UX Decisions

### Layout

The globe is **always full-screen** — it never shares width with any other element. All UI panels float above it as overlays.

```
z-index 0    Globe          full-screen, always rendered behind everything
z-index 100  Feed panel     slides in/out from right, overlays right portion of globe
z-index 100  Upload panel   full-screen overlay, covers globe entirely when active
z-index 200  Left strip     always on top of every layer, never moves
```

**Explore mode:**
```
┌─────────────────────────────────────────┐
│[👤]                        ┌──────────┐ │
│                             │[🔍      ]│ │
│[🗺]      GLOBE              │──────────│ │
│[⬆]   ●       ●             │  feed    │ │
│                             │  content │ │
│[🛒]      ●                  │          │ │
│                             └──────────┘ │
└─────────────────────────────────────────┘
```

**Upload mode:**
```
┌─────────────────────────────────────────┐
│[👤] ┌───────────────────────────────┐   │
│     │                               │   │
│[🗺] │         DROP ZONE             │   │
│[⬆] │                               │   │
│     │  ┌─────────────────────────┐  │   │
│[🛒] │  │ 📍 Pipeline           ▾ │  │   │
│     │  │ 📅 Today              ▾ │  │   │
│     │  │ 💰 $15 per photo        │  │   │
│     │  │        [Publish 12 →]   │  │   │
│     │  └─────────────────────────┘  │   │
│     └───────────────────────────────┘   │
└─────────────────────────────────────────┘
```

### Left strip

A narrow floating column anchored top-left, always visible at the highest z-index:

```
[👤]  ← avatar / profile access
[🗺]  ← explore mode indicator
[⬆]  ← upload mode indicator
[🛒]  ← cart (only when items present)
```

- Explore and Upload act as a toggle pair
- Strip never moves, never animates, never hides
- Floats over the globe, the feed panel, and the upload panel equally

### Explore / Upload switcher

- Lives on the **left strip** — `[🗺]` and `[⬆]` icons as a toggle pair
- Switching to Upload: feed panel slides out to the right, upload panel expands full-screen over the globe
- Switching to Explore: upload panel closes, globe reappears, feed panel slides back in from the right
- Visible to all users including logged-out
  - Logged-out tap on Upload → "Join Wave Atlas to share your sessions" signup prompt

### Search bar

- **Moves from the globe surface to the top of the feed panel**
- Results render in the panel body; globe flies to the matched spot
- In Upload mode, the feed panel is hidden — the same search component appears inside the session form card as the spot selector
- Globe surface clean in explore mode: only standard map controls remain (zoom, compass, geolocate) in a corner

### Feed Panel — default state

- Shows recent sessions globally, reverse chronological
- **Map viewport is the location filter** — dragging or zooming the globe updates the feed to sessions from the visible area; no location dropdown needed
- Date filter chips at the top of the panel body: `[Today]  [This week]  [All time]`
- Panel tab strip: `[Feed]  [My Sessions]` — visible to all logged-in users

### Sessions

- **Session = photographer + spot + calendar day**
- Auto-created on first upload; subsequent uploads to the same spot on the same day by the same photographer join the existing session silently
- Optional title set after upload ("Morning glass", "Swell day") — never blocks the upload
- Feed row shows: photographer name · spot name · time ago · 4-photo preview strip · photo count

### Session gallery flow

```
Feed (panel)
  → click session row
      map flies to spot, pin highlights
      panel: session thumbnail grid
        → click thumbnail
            main area: full photo + watermark  (globe hidden)
            panel: thumbnail grid, selected thumb highlighted
        → click another thumbnail
            main area updates instantly
  → breadcrumb: ← Feed · [Spot] · [Photographer · Date]
      clicking [Spot] → all sessions at that spot
      clicking ← Feed → feed returns, globe returns
```

No lightbox modal. The main area IS the lightbox. No z-index stacking, no overlay mechanics.

### Photo purchase

- `[Add to cart · $15]` button overlaid at the bottom of the full photo in the main area
- Checkboxes on thumbnails for multi-select
- Sticky panel footer appears when ≥ 1 item selected: `▓▓▓  Buy 3 · $45  ▓▓▓`
- Footer is empty when nothing is selected — no persistent clutter

### Activity-graded map pins

Spot pins reflect session activity visually:

| State | Appearance |
|---|---|
| No recent sessions | Dim / grey |
| Sessions this month | Normal |
| Sessions this week | Bright |
| Session today | Bright + pulsing |

Requires `latestSessionAt` on the `spots.list` tRPC response.

### Secret spot zoom-reveal

- `Spot.mapRevealZoom: Int` field
  - `0` = always visible (public known break — default)
  - `~10` = visible only at regional zoom
  - `~14` = visible only at street-level zoom (secret)
- Name search **always** reveals regardless of zoom — flies the map to the spot and shows the pin
  - The spot name travels through word-of-mouth; knowing the name is the access key
- Photographers set `mapRevealZoom` when creating or editing a spot
- Primary use case (surfer finding photos of themselves at a known break) is unaffected — public spots stay at `0`

### Upload mode

- Tap `[⬆]` on left strip → feed panel slides out right, full-screen upload panel expands over the globe
- Upload panel contains: drop zone (full area) + session form card (floating, centred bottom)
- Session form card: spot search (same component as feed search, relabelled "Where did you shoot?"), date (auto-today), optional title, price per photo
- Per-file upload progress bars appear above the session form card as files land
- Upload continues in the background if the user taps `[🗺]` to switch back to Explore; left strip shows a count indicator on the upload icon: `[⬆●3]`
- Draft is auto-saved from first file; `[Publish N →]` is the deliberate final step
- After publish: upload panel closes, globe reappears, feed panel slides back in, new session at top of feed

### Dual-role users

- **No role system** — every logged-in user can browse and upload
- The app does not ask "are you a surfer or photographer?" at registration
- Onboarding asks only: *"What brings you here?"* → sets default panel tab (Feed vs My Sessions), nothing else, no locked features
- `[My Sessions]` tab in panel shows own uploaded sessions and drafts
  - Empty state: "No sessions yet — `[↑ Upload your first]`"

### Location privacy

Handled by `mapRevealZoom` (see above). Three practical tiers:

| Spot type | mapRevealZoom | Map shows |
|---|---|---|
| Famous public break | 0 | Always — precise pin |
| Semi-known regional break | ~10 | Regional zoom required |
| Secret spot | ~14 | Street-level zoom only |

Name search bypasses the zoom gate in all cases. Photographers who shoot truly secret spots and want zero map presence can use the direct session link flow (photographer shares link with clients; spot never appears on the globe).

---

## Migration Plan

**Principle:** frontend-first, schema-second. Each phase is independently deployable with no regression to existing functionality.

---

### Phase 1 — Layout foundation
*Pure frontend. No schema changes. All existing routes continue to work.*

| Step | Change | Verify |
|---|---|---|
| 1.1 | Globe becomes true full-screen (`position: fixed; inset: 0`) — remove any width-sharing with other elements | Globe fills viewport |
| 1.2 | Add left strip as floating overlay (`position: fixed; top: 0; left: 0; z-index: 200`) — avatar, explore/upload toggle, cart icon | Strip visible over globe at all times |
| 1.3 | Feed panel as right overlay (`position: fixed; top: 0; right: 0; z-index: 100; width: ~380px`) — slides in/out | Feed panel overlays right portion of globe |
| 1.4 | Update `DrawerLayout.tsx` — swap `Drawer.Header/Body/CloseButton` for plain divs; existing `/_drawer` routes render inside feed panel | No visual regression in child routes; spot gallery, cart, my collection all work |
| 1.5 | Move search bar from `GlobeScene` into feed panel header | Search works from panel; globe surface clean |
| 1.6 | Upload panel as full-screen overlay (`position: fixed; inset: 0; z-index: 100`) — toggled by strip switcher; stub content only | Switching to Upload hides globe and feed; switching back restores them |
| 1.7 | Feed stub — panel shows "Recent sessions coming soon" below search | Panel is never blank in explore mode |
| 1.8 | Upload stub — drop zone placeholder + empty session form card | Upload mode renders without errors |

---

### Phase 2 — Session schema
*Backend only. No UI changes beyond wiring existing upload to auto-create sessions.*

| Step | Change | Verify |
|---|---|---|
| 2.1 | Add `Session` model to Prisma schema (`id`, `spotId`, `photographerId`, `date`, `title?`, `createdAt`) | Migration runs cleanly |
| 2.2 | Add `sessionId` FK on `MediaItem` (nullable for existing rows) | Existing media unaffected |
| 2.3 | Auto-creation in upload pipeline — find-or-create session for `photographerId + spotId + today` | Two uploads same day/spot/photographer share one session |
| 2.4 | `sessions.list(spotId)` tRPC procedure | Returns sessions with photographer, date, photo count, preview thumbnails |
| 2.5 | `sessions.listRecent(bounds?)` tRPC procedure — global feed, paginated, optional map bounds filter | Returns feed data |
| 2.6 | Add `latestSessionAt` to `spots.list` response | Field present on all spot records |

**Backlog impact:** drives #19 (upload limits), #34 (gallery pagination), resolves #52 session decision.

---

### Phase 3 — Live feed + activity pins
*Wire Phase 2 data to Phase 1 panel. No schema changes.*

| Step | Change | Verify |
|---|---|---|
| 3.1 | Replace feed stub with real `sessions.listRecent()` data — session rows with preview strip | Feed shows real sessions |
| 3.2 | Map viewport filter — on globe drag/zoom call `sessions.listRecent({ bounds })` | Feed updates as map moves |
| 3.3 | Date filter chips — `Today / This week / All time` — pass as param to `listRecent` | Chips filter feed correctly |
| 3.4 | Activity-graded pin colours in `GlobeScene` using `latestSessionAt` | Pins reflect activity; pulsing for today's sessions |

---

### Phase 4 — Session gallery + purchase flow
*Replace flat photo dump with session-based browsing. Closes the biggest UX gap.*

| Step | Change | Verify |
|---|---|---|
| 4.1 | Click session row → panel navigates to thumbnail grid; map flies to spot | Panel shows thumbnails; globe shows spot |
| 4.2 | Click thumbnail → main area shows full photo + watermark (globe hidden) | Photo fills main area with watermark |
| 4.3 | Breadcrumb navigation in panel (`← Feed · Spot · Session`) | Back steps work correctly |
| 4.4 | Clicking spot name in breadcrumb → all sessions at that spot | Spot session list renders |
| 4.5 | Checkbox selection on thumbnails | Multi-select state managed correctly |
| 4.6 | `[Add to cart · $15]` on full photo in main area | Adds to cart |
| 4.7 | Sticky panel footer — cart total, appears when ≥ 1 selected | Footer appears/disappears; total is correct |
| 4.8 | Back from photo → globe returns; back from session → feed returns | Globe restoration works |

---

### Phase 5 — Upload mode
*Full photographer upload flow via switcher.*

| Step | Change | Verify |
|---|---|---|
| 5.1 | Switcher `[↑ Upload]` activates drop zone in main area | Drop zone renders; globe hidden |
| 5.2 | Panel in Upload mode: spot search (reuse feed search component), date auto-fill, optional title, price per photo | Form pre-fills correctly; spot search returns results |
| 5.3 | Per-file upload progress in main area | Progress bars update in real time |
| 5.4 | Background upload continues on Explore switch; indicator in switcher tab | Files upload while user browses; indicator count accurate |
| 5.5 | `[My Sessions]` tab in panel — own sessions list, draft management | Own sessions visible; drafts accessible |
| 5.6 | After publish: globe returns, panel returns to feed, new session at top | Full round-trip verified |

---

### Phase 6 — Secret spots + polish
*Location privacy, onboarding, logged-out experience.*

| Step | Change | Verify |
|---|---|---|
| 6.1 | Add `mapRevealZoom: Int` to `Spot` schema + migration; default `0` | Existing spots unaffected |
| 6.2 | `GlobeScene` renders pins only above their `mapRevealZoom` threshold | Secret pins invisible until correct zoom |
| 6.3 | Name search bypasses zoom gate — flies to spot and reveals pin regardless of zoom | Search reveals secret spots by name |
| 6.4 | Spot create/edit UI: privacy level selector → maps to `mapRevealZoom` preset values | Photographers can set privacy |
| 6.5 | Logged-out upload prompt — "Join Wave Atlas to share your sessions" on switcher tap | Prompt renders; links to registration |
| 6.6 | Onboarding default tab preference (Feed vs My Sessions) | Preference applied on first load |

---

## Backlog items driven by this plan

| Item | Relation |
|---|---|
| #19 — per-photographer upload limits | Session entity defines the scope |
| #34 — gallery infinite scroll + virtualisation | Scopes to session, not spot-wide |
| #52 — session decision | ✅ Decided — see this document |
| #57 — secret spot zoom-reveal | ✅ Decided — Phase 6 |
| New — `sessions` tRPC procedures | Phase 2 |
| New — `latestSessionAt` on spots | Phase 2 |
| New — layout migration | Phase 1 |
| New — feed panel | Phase 3 |
