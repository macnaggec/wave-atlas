 # Swelldays - Platform Requirements

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
-  sale / upload management can only be performed by authorized users

### 3.2. Media Content Management (for Photographers)
- Photographers can upload media files (photos and videos) to the platform.
- **Watermarking:** Lightbox preview versions of videos and photos must be automatically protected with a watermark ("swelldays" logo).
- Photographers can set a price for each media file.
- Photographers can publish or hide their media files from public access.
- Photographers can view a list of their uploaded media files.
- Photographers can delete their media files.

#### 3.2.1. Detailed Upload Requirements

**Location and Access:**
- Upload functionality opens on the side panel by clicking on upload button
- User selects spot on map or search dropdown → click upload → select files
- Media is automatically linked to the selected spot
- Access only for authorized users

**Upload Workflow (Draft System):**
1. **Upload**: User selects files → files upload to Cloudinary
2. **Review/Edit**: Uploaded files are saved as drafts
3. **Publish**: User publishes from the same upload sidebar (Publish / Save button) — there is no separate dashboard

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
- Publishing happens manually via the upload sidebar's Publish / Save button

**Draft Editing:**
- **Date/time**: Edited calendar and time range on time step
- **Price**: One photo price and one video price per session, applied to all photos and all videos in that session respectively — not set per individual file
- **Defaults**: Date = auto (from EXIF), Price = 3$ (minimal wage)
- **Bulk Operations**:
  - Select multiple drafts → apply context action to all selected
  - If nothing selected → action apply to all drafts
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

*Single Draft Context:* A photographer can have at most one active draft session at a time, regardless of which spot it's for — not one per spot. Starting a new upload or opening a published session for editing while a draft is already active is blocked.

*Draft Indicator:* The header Upload button shows an indicator when the photographer has a genuinely new, never-published draft with unfinished content. The indicator does not activate just because a published session is currently being edited (editing temporarily reuses the same draft status internally, but isn't a "new upload waiting to be resumed").

**Error Handling:**
- On error: show error on specific file, allow individual retry
- Warning (beforeunload) when attempting to leave browser page during upload

**Preview Generation with Watermark:**
- Occurs after clicking the "Publish" button internally
- Watermark applied to preview versions (not originals)
- Original files stored without watermark for buyers

**Publishing:**
- The Publish button is enabled once the draft session has a spot, a start time, an end time, a photo price, a video price, and at least one media item, and none of its media has an active or failed upload still in progress
- Publishing publishes every media item in that draft session together — not scoped by spot beyond the session's own spot
- After publishing, media becomes visible to buyers with watermark

**Technical Implementation:**
- **Storage**: Cloudinary for all files (originals + watermarked previews)
- **Upload method**: Cloudinary Upload API
- **Concurrency**: 3-5 parallel uploads
- **Progress tracking**: Individual per-file progress
- **State management**: Draft status in database (Media model)
- **Spot assignment**: Automatic from context (selected spot on map)

#### 3.2.2. Session Draft, Edit & Cancel Lifecycle

**Editing a Published Session:**
- Photographers can reopen a previously published session for editing, using the same upload sidebar used to create it — there is no separate edit form.
- Reopening a session for editing temporarily reverts it, and its media, back to draft status so it can be revised.
- A photographer cannot open a second session for editing (or start a new upload) while one edit is already in progress — the same one-active-draft rule applies.
- Changes to spot, date/time, and prices made during an edit are not applied to the live session until the edit is explicitly saved.
- Removing an existing media item during an edit only stages it for removal — the item stays visible in the live, published session until the edit is saved.
- Adding new media during an edit uploads it immediately, but it is not shown publicly until the edit is saved.
- The photo/video price visibility rule below applies during editing too, based on the current in-progress set of media (including newly added items, excluding items staged for removal).
- Saving an edit is subject to the same completeness requirements as publishing a new session (spot, start/end time, both prices, at least one media item).
- Saving commits all staged changes together in one action — updated fields, newly added media, and staged removals.

**Cancelling:**
- Cancelling a new (never-published) upload discards everything added during that session — all uploaded files, and any file still uploading — and nothing is published.
- Cancelling an edit of a previously published session restores it to exactly the state it was in before the edit began: original media returns to published at its original spot/price, and any spot/date/price changes made during the edit are discarded.
- Cancelling an edit discards any media that was added during that edit — it never becomes published.
- Cancelling — for both a new upload and an edit — stops any file uploads still in progress; a file that was still transferring when Cancel was clicked is not allowed to complete and appear afterward.
- Media staged for removal during an edit is not actually removed if the edit is cancelled — it stays exactly as it was before the edit.
- Leaving the upload or edit screen without explicitly clicking Save or Cancel is treated as Cancel.
- A cancelled or discarded draft that ends up with no content immediately frees the photographer to start a new upload or open a different session for editing — it never permanently blocks future uploads.

**Deleting Media:**
- Photographers can remove individual media items from a draft or an in-progress edit before saving or publishing.
- Removing a draft media item that has never been purchased permanently deletes it and its stored file.
- Removing a media item that has already been purchased by a buyer keeps it available to that buyer, even though it is removed from the photographer's session and from public view.

**Removing a Published Session:**
- A photographer can remove an entire published session from public view.
- Removing a published session keeps previously purchased media accessible to the buyers who purchased it.

**Photo / Video Price Visibility:**
- The photo price field is hidden if the session contains no photos; the video price field is hidden if the session contains no videos.
- Before any files have been added to a session, both price fields are shown.

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
- All spots use the native blue wave on a translucent glass substrate; the selected spot adds a soft blue glow

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


### 4.2 Pricing Model

- **Model: Net (list price)**. Photographer sets the public price. Platform deducts commission.
- **Commission: 20%** of the list price goes to the platform.
- **Photographer earns: 80%** of the list price per item sold.
- **Minimum price: $3.00** per media file. Prevents economically unviable transactions after fees.
- **Currency: USD only** for MVP. Photographers receive USD payouts and convert locally through their bank.

### 4.3 Cart & Checkout

- Buyers add multiple media items to a cart and pay in a single transaction.
- Single-charge per cart reduces transaction fees, benefiting all parties.
- After successful payment, buyer receives download links to original (unwatermarked) files in their account.

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
