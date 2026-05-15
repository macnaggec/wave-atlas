# Google Drive Picker UI — Design Spec

## Problem

Photographers need to import media from Google Drive into the upload workflow. The server-side infrastructure (`registerDriveImport`, `MediaImportService`, `DRIVE_PENDING` status) already exists. This spec covers the client-side UI only.

## Design Decisions

- **Drive is the primary source; local upload is the escape hatch.** The UI makes Drive unmissably prominent and local secondary.
- **No background processing state.** `DRIVE_PENDING` is a stable pre-publish state, not an in-flight operation. Cloudinary import happens at publish time (`publishDriveItem`). Cards appear immediately after import with Google's own thumbnail URL.
- **Per-item publish tracking** is client-only. No server changes needed.
- **Gallery tab red dot** fires after publish, nudges the user to review their live gallery.

---

## 1. AddSourceCard

Replaces `AddFileCard` as the first card in the upload gallery grid.

**Behaviour:**
- Same slot, same aspect ratio as `AddFileCard` today.
- Same CSS classes and dashed-border style as `AddFileCard.module.css`.
- Two stacked buttons inside the card:
  - Primary: `Import from Google Drive` (solid blue, Mantine `Button` with Google Drive icon)
  - Secondary: `Choose local files` (ghost/outline, triggers hidden file input — same logic as current `AddFileCard`)
- Disabled state (blocked upload) applies to both buttons, same as today.
- `BlockedUploadPopover` wrapper unchanged.

---

## 2. Google Picker Hook — `useGooglePicker`

New hook at `features/Upload/model/useGooglePicker.ts`.

**Responsibilities:**
1. Load `gapi` and Google Identity Services (GIS) scripts once (via `index.html` script tags).
2. On trigger, call `google.accounts.oauth2.initTokenClient` with `drive.readonly` scope and `prompt: ''` (silent reuse if a Google session exists; popup only on first consent).
3. On token received, open `google.picker.PickerBuilder` overlay allowing multi-select of images and videos.
4. On picker callback (`PICKED` action), for each selected file call `media.registerDriveImport` tRPC mutation.
5. For each returned `MediaItem`, call `useDraftMediaMutate.append(item)` — card appears in gallery immediately.

**Error handling:**
- OAuth denied → show error notification, no-op.
- `registerDriveImport` failure → show per-file error notification.

**No polling.** `DRIVE_PENDING` items are stable and ready to edit/publish immediately.

---

## 3. DRIVE_PENDING Card

No new card component. `UploadCardRenderer` renders `DRIVE_PENDING` items via the existing `DraftCard`.

**Differences from a regular draft card:**
- `imageUrl` = `driveThumbnailUrl` (Google URL, not Cloudinary).
- A small `🔵 Drive` badge (Mantine `Badge`, `variant="light"`, `color="blue"`) overlaid top-left on the card image, signalling origin.
- Otherwise identical: price/date badges, selectable, editable, publishable.

`UploadCardRenderer` detects `DRIVE_PENDING` via `item.result?.status === 'DRIVE_PENDING'` and renders the badge.

---

## 4. Per-Item Publish Tracking

Changes to `usePublish`:

- Add `publishingIds: Set<string>` state (starts empty).
- On `handlePublish`:
  1. Add all target `mediaIds` to `publishingIds` → button becomes disabled immediately.
  2. Await `publishMedia` mutation.
  3. On success: clear `publishingIds`, call existing `onSuccess` (removes cards, triggers gallery dot).
  4. On failure: clear `publishingIds` (re-enables button), existing error toast fires.

Changes to `UploadCardRenderer`:

- Accept `isPublishing: boolean` prop.
- When `true`, render `renderUploadOverlay` with status `'saving'` (shows `Loader` + `"Publishing…"` label) — reuses existing overlay renderer, no new UI code.

Changes to `PublishButton`:

- Disable when `isPublishing` is true (already receives `isPublishing` prop).

---

## 5. Gallery Tab Red Dot

**Trigger:** fires once after a successful publish call, regardless of whether items were Drive or local.

**Implementation:**
- `SpotLayout` (`_drawer.$spotId.tsx`) holds `hasNewGallery: boolean` local state (starts `false`).
- Pass `onPublishSuccess` callback down through `UploadTab` → `UploadManager`. On success, set `hasNewGallery = true`.
- `useEffect` in `SpotLayout` watching `activeTab === 'gallery'`: set `hasNewGallery = false`.
- Render `Indicator` (Mantine) wrapping the `Gallery` tab label when `hasNewGallery` is true.

**Scope:** session-local, per-spot, no persistence.

**Wire path:** `SpotLayout` → `UploadTab` (via route search param or context) → `UploadManager.onPublishSuccess`.

Since `UploadTab` is a route component and `SpotLayout` is its parent route, the cleanest path is:
- `SpotLayout` passes `onPublishSuccess` via React context (new minimal context: `SpotUploadContext`).
- `UploadTab` consumes context and passes to `UploadManager`.

---

## 6. External Scripts

Add to `index.html` before `</body>`:

```html
<script src="https://apis.google.com/js/api.js" async defer></script>
<script src="https://accounts.google.com/gsi/client" async defer></script>
```

Required env vars (already present for auth): `VITE_GOOGLE_CLIENT_ID`.

---

## 7. Files Changed

### New
| File | Purpose |
|------|---------|
| `features/Upload/ui/cards/AddSourceCard.tsx` | Drive-first stacked-button card |
| `features/Upload/model/useGooglePicker.ts` | GIS token + Picker + registerDriveImport |

### Modified
| File | Change |
|------|--------|
| `features/Upload/ui/UploadGallery/UploadGallery.tsx` | Swap `AddFileCard` → `AddSourceCard` |
| `features/Upload/ui/UploadGallery/UploadCardRenderer.tsx` | Drive badge; accept + render `isPublishing` |
| `features/Upload/ui/UploadGallery/types.ts` | Add `isPublishing` to gallery item props |
| `features/Upload/model/usePublish.ts` | Add `publishingIds` set; return it |
| `features/Upload/ui/UploadManager.tsx` | Thread `publishingIds` to gallery; accept + forward `onPublishSuccess` |
| `app/routes/_drawer.$spotId.tsx` | Add `hasNewGallery` state; Gallery tab `Indicator`; `SpotUploadContext` |
| `app/routes/_drawer.$spotId.upload.tsx` | Consume `SpotUploadContext`, pass to `UploadManager` |
| `index.html` | GIS + gapi script tags |

---

## 8. Out of Scope

- Server changes (backend is complete).
- Polling or real-time updates (not needed — `DRIVE_PENDING` is stable).
- Progress tracking per Drive file during Cloudinary import at publish time (the existing button spinner + "Publishing…" card overlay is sufficient for now).
- Persisting the gallery dot across sessions.
