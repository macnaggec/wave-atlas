 # Wave Atlas - Platform Requirements

The platform is designed for photographers who can upload and sell their photos and videos, and for surfers who can search, view, and purchase this content.
The site contains a catalog of surf spots and each media file is attached to a specific spot.

The central functionality of the site is an interactive map with date-based search and the ability to purchase or add content to favorites or cart.

Interface language: English.

## 2. Main Participants (Roles)

- **Photographer (Seller):** User who uploads media content for sale.
- **Surfer (Buyer):** User who searches for and purchases media content.
A user can have both roles simultaneously.

## 3. Functional Requirements

### 3.1. Authentication and User Management
- Users can register and log in using email and password.
- Authentication via Google and Facebook is provided.
- Users can log out.
- Purchase / sale / upload management can only be performed by authorized users

### 3.2. Media Content Management (for Photographers)
- Photographers can upload media files (photos and videos) to the platform.
- **Watermarking:** All preview versions of videos and photos must be automatically protected with a watermark ("wave-atlas" logo).
- Photographers can set a price for each media file.
- Photographers can publish or hide their media files from public access.
- Photographers can view a list of their uploaded media files.
- Photographers can delete their media files.

#### 3.2.1. Detailed Upload Requirements

**Location and Access:**
- Upload functionality is located in the side panel of the selected spot on the map
- User selects spot on map → side panel opens → "Upload" tab
- Media is automatically linked to the selected spot
- Access only for authorized users

**Upload Workflow (Draft System):**
1. **Upload**: User selects files → files upload to Cloudinary
2. **Review/Edit**: Uploaded files are saved as drafts
3. **Publish**: User manually publishes drafts from dashboard

**Supported File Formats:**
- **Images**: JPEG, PNG, HEIC (and other formats from cameras/smartphones)
- **Videos**: MP4 (H.264/H.265), MOV (iPhone/GoPro)
- Formats determined by camera, smartphone, and action camera capabilities

**Metadata Processing (EXIF):**
- Automatic extraction of capture date from EXIF
- Date displays on draft overlay with "auto" badge
- If user manually changes date, "auto" badge disappears
- GPS and other data extracted for internal use

**Draft System:**
- Uploaded files are saved as drafts (not visible to buyers)
- **Draft States**:
  - **Uploading**: Overlay with individual progress bar and cancel button (cancel icon)
  - **Ready to publish**: Overlay with date badge (+ "auto" badge if auto detected), price badge, delete button (delete icon)
- Ready to publish drafts can be edited before publishing
- Publishing happens manually via dashboard

**Draft Editing:**
- **Date/time**: Edited via bulk edit popover
- **Price**: Edited via bulk edit popover
- **Defaults**: Date = auto (from EXIF), Price = 0 (free badge)
- **Bulk Operations**:
  - Select multiple drafts → apply date/price to all selected
  - If nothing selected → changes apply to all drafts
  - Disabled if there are no ready to publish drafts or any draft is in uploading state.

**Validation:**
- **Client-side**:
  - File size check (images: 10MB, videos: 50MB)
  - File format check
  - File count check (max 20 per batch)
  - Total batch size check (max 200MB)
  - Date isn't empty
- **Server-side**:
  - Re-validation of all parameters
  - Virus scan
  - Daily limit check (100 uploads/day)

**Progress**
- Concurrent upload of 3-5 files simultaneously
- Individual progress spinner for each file, disappears when ready.
- Cancel button for files in progress
- Successfully uploaded files are saved even if others fail
- Selection mode should be disabled if user starts uploading

**Upload Progress Indicator (Global State):**

*Single Upload Context:* Only one spot can have active uploads at a time. Other spots are blocked until current upload completes.

*Indicator Display Contexts:*

1. **Main Page - Floating Affix (Full View)**
   - **Position:** Top-right corner
   - **Style:** Animated pulsing icon + text "Uploading to [Spot Name] X/Y"
   - **Show when:** Active uploads exist AND SidePanel is closed
   - **Hide when:** SidePanel opens OR no active uploads
   - **Interaction:** Click anywhere → Navigate directly to `/{spotId}?tab=upload`
   - **NO popover:** All info visible in full view

2. **Upload Tab Title - Activity Spinner**
   - **Position:** Tab title next to "Upload" text
   - **Style:** Small spinner (Loader component)
   - **Show when:** Active uploads exist (any spot)
   - **Hide when:** No active uploads
   - **Visual:** "⟳ Upload" (spinner before text)
   - **Purpose:** Passive signal that Upload tab has activity
   - **Interaction:** None (tab itself is clickable for navigation)

3. **Upload Tab Toolbar - Upload Pill (Different Spot)**
   - **Position:** Toolbar left edge (shifts other controls right)
   - **Style:** Pill-style component (filled, rounded, matching toolbar pills aesthetic)
   - **Text:** "Uploading to …"
   - **Tooltip:** On hover, show `[Spot Name] X/Y` (spot name and upload progress)
   - **Show when:** Active uploads exist AND user on Upload tab AND current spot is NOT the uploading spot
   - **Hide when:** User on uploading spot's Upload tab OR no active uploads
   - **Interaction:** Click pill → Navigate directly to `/{spotId}?tab=upload` via `router.push()`
   - **Color:** Prominent theme color (e.g., primary or accent)
   - **Accessibility:** Pill is focusable and keyboard-navigable

4. **AddFileCard - Blocked State**
   - **Visual:** Disabled (gray, opacity 0.5, not-allowed cursor)
   - **Show when:** Active uploads exist on another spot (current spot blocked)
   - **Interaction:** Click → Opens popover with upload details and navigation link
   - **Does NOT navigate directly:** Navigation only via link inside popover

*Popover Content (AddFileCard Only):*
- Used by: AddFileCard (blocked state)
- **Content:** `[Upload Icon] Uploading to [Spot Name Button] X/Y`
  - Upload icon (pulsing animation)
  - Text: "Uploading to "
  - Clickable button styled as link: "[Spot Name]" → navigates to `/{spotId}?tab=upload` via `router.push()`
  - Progress text: "X/Y" (completed/total count, dimmed)
- **Trigger:** Click only
- **No progress bar:** Simplified design

*Upload Blocking:*
- When uploads active, other spots cannot start uploads
- Blocked spots show disabled AddFileCard with popover explaining status
- User can navigate to active upload via indicator or popover link


**Error Handling:**
- On error: show error on specific file, allow individual retry
- Warning (beforeunload) when attempting to leave browser page during upload

**Preview Generation with Watermark:**
- Occurs after clicking the "Publish" button internally
- Watermark applied to preview versions (not originals)
- Original files stored without watermark for buyers

**Publishing:**
- "Publish all" button appears if all drafts are valid and ready
- "Publish all" button publishes all ready drafts of current spot
- After publishing, media becomes visible to buyers with watermark

**Technical Implementation:**
- **Storage**: Cloudinary for all files (originals + watermarked previews)
- **Upload method**: Cloudinary Upload API
- **Concurrency**: 3-5 parallel uploads
- **Progress tracking**: Individual per-file progress
- **State management**: Draft status in database (Media model)
- **Spot assignment**: Automatic from context (selected spot on map)

### 3.3. Content Purchase/Sale
- Users can pay for items in cart using credit card.
- After successful payment, user receives a temporary link to original files (without watermark) in their personal account.
- Platform receives a percentage of each sale.
- Seller receives their set amount minus platform percentage.

### 3.4. Search
- Surf spot catalog exists
- Each surf spot has a gallery with date sorting
- Interactive map with spots needed for engagement and exploration

### 3.5. Spot Creation & Deduplication

**Search-first entry point:**
- The search bar is the only way to trigger spot creation — there is no standalone "Add spot" button
- **Authenticated users**: a fixed "Add as a new spot" button appears in the dropdown when a search returns no results
- **Unauthenticated users**: an inline "Sign in to add as a new spot" text prompt is shown instead; the auth modal opens without closing the dropdown so that after sign-in the Add button is immediately visible
- The current search term pre-fills the name field when the user proceeds to add the spot

**Pin-placement mode (globe-native UX):**
- Clicking "Add as a new spot" transitions the GlobeScene into **pin-placement mode** — no modal, no separate map
- The existing globe becomes fully interactive for pin placement
- The Header is hidden; a floating `AddSpotPanel` appears at the top-centre of the screen
- Existing spots remain visible on the globe but are **non-interactive** during placement (clicks only place the pin)
- Globe auto-rotation is disabled in pin-placement mode
- The cursor changes to a crosshair to signal click-to-place behaviour
- Coordinates are derived from the Mapbox `lngLat` of the click event — users never type coordinates manually

**AddSpotPanel — 3-step flow:**
1. **Hint step**: "Click on the map to place your spot" instruction; Cancel button exits pin-placement mode
2. **Form step** *(after pin placed)*: name field (pre-filled from search), location field (reverse-geocoded from Mapbox); Back (clears pin, returns to hint) + Cancel + "Add as a new spot" submit button
3. **Proximity step** *(if existing spot within 300 m)*: "Did you mean X?" warning; Back (returns to form) + Cancel + "Add anyway" button
- Cancel is always available on every step and fully exits pin-placement mode

**Temp pin marker:**
- Displayed as a 28 px blue circle (matching the verified-spot icon colour `#3b82f6`) with a pulsing glow animation
- Anchored at **center** so it sits exactly on the crosshair click point
- Disappears when the user goes Back from the form step

**GPS proximity guard:**
- After the form is submitted, the system checks for any existing spot within **300 m** radius
- If a nearby spot is found, a "Did you mean?" prompt is shown before the spot is saved — this is a **soft warning, not a hard block**
- The user can dismiss the prompt and proceed (legitimate cases exist where distinct breaks are only ~300 m apart, e.g. Padang Padang Pro vs. Baby Padang Padang)
- This guard is the primary nudge against accidental duplicates, not an enforcement mechanism

**Post-creation behaviour:**
- After the spot is created it is injected into the `spots.list` query cache optimistically so it appears on the map immediately without a reload or skeleton state
- Navigation proceeds to the new spot's upload tab directly

**Spot markers:**
- All spots (verified and unverified) use the same substrate circle radius (14 px) so the wave icon is consistently framed
- Unverified spots are distinguished by a grey icon colour; verified spots use blue

**Aliases (alternative / local names):**
- Each spot stores a primary name and a list of aliases (e.g. `Jeffreys Bay` → aliases: `["J-Bay", "Supertubes"]`)
- Search runs over both primary name and all aliases
- Aliases are applied instantly — no moderation step required
- Users can suggest an alias from two places:
  1. **Search results** — a "Known by another name?" link next to a result lets the user add an alias for that spot inline
  2. **Spot panel** — a subtle "Suggest a name" link inside the spot detail panel

### 3.5 Gallery
- When selection mode enabled there shouldn't be individual card actions; all actions should be in actions menu

---

## 4. Payment System

### 4.1 Overview

MVP payment architecture: **Lemon Squeezy** as payment processor (Merchant of Record) + **Wise** for manual photographer payouts.

### 4.2 Pricing Model

- **Model: Net (list price)**. Photographer sets the public price. Platform deducts commission invisibly — industry standard (Getty, Shutterstock, Etsy).
- **Commission: 20%** of the list price goes to the platform.
- **Photographer earns: 80%** of the list price per item sold.
- **Minimum price: $3.00** per media file. Prevents economically unviable transactions after fees.
- **Currency: USD only** for MVP. Photographers receive USD payouts via Wise and convert locally through their bank.

**Example:**
| List price | Platform (20%) | Photographer (80%) |
|------------|----------------|--------------------|
| $3.00      | $0.60          | $2.40              |
| $10.00     | $2.00          | $8.00              |
| $25.00     | $5.00          | $20.00             |

### 4.3 Cart & Checkout

- Buyers add multiple media items to a cart and pay in a single transaction.
- Single-charge per cart reduces Lemon Squeezy transaction fees, benefiting all parties.
- After successful payment, buyer receives temporary download links to original (unwatermarked) files in their account.

### 4.4 Photographer Payouts

- **Method:** Manual via Wise (MVP). Platform operator initiates transfers manually upon request.
- **Payout threshold: $20.00** minimum accumulated balance before a payout can be requested.
  - Rationale: Wise per-transfer fees make sub-$20 payouts economically wasteful.
- **Payout flow:**
  1. Photographer requests payout from their dashboard (once threshold is met).
  2. Platform operator reviews pending requests and manually sends funds via Wise.
  3. Photographer receives USD; their bank converts to local currency.
- **Wise fee:** Absorbed by the platform for MVP simplicity. Re-evaluate post-MVP if payout volume grows.

### 4.5 Balance Tracking

- Platform tracks each photographer's accumulated earnings in the database.
- Balance increases on each completed sale (80% of item list price).
- Balance decreases when a payout is processed and confirmed by the operator.
- Photographers can view their current balance and payout history in their dashboard.

### 4.6 Refund Policy

- **No refunds on digital downloads** — enforced via platform Terms of Service.
- Buyers can preview watermarked content and see original resolution metadata before purchasing, providing sufficient information to make a purchase decision.
- Lemon Squeezy (as MoR) may still process card chargebacks in rare dispute cases — handled case-by-case.

### 4.7 Post-MVP Considerations

- Automated payouts via Wise API when volume justifies it.
- Multi-currency payout support.
- Reduced Wise fee burden via batching multiple photographers into one transfer cycle.
- Review commission rate and Wise fee absorption policy based on actual margins.
