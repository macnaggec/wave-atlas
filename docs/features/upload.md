# Upload Feature — Architecture Guide

> `src/features/Upload/` · `src/entities/Media/` · tRPC `media.*`

---

## System Overview

```
┌────────────────────────────────────────────────────────────────────┐
│  features/Upload                                                   │
│                                                                    │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  ui/UploadManager.tsx  — composition root                   │   │
│  │  (wires all hooks, owns selection state)                    │   │
│  └───┬──────────┬───────────────┬───────────────┬──────────────┘   │
│      │          │               │               │                  │
│  ┌───▼──┐  ┌────▼────┐   ┌──────▼──────┐  ┌─────▼─────────┐        │
│  │Queue │  │ Manager │   │DraftEditing │  │   Publish     │        │
│  │Hook  │  │  Hook   │   │    Hook     │  │    Hook       │        │
│  └───┬──┘  └────┬────┘   └──────┬──────┘  └─────┬─────────┘        │
│      │          │               │               │                  │
│  ┌───▼──────────▼───────────────▼───────────────▼───────────────┐  │
│  │                    State Layer                               │  │
│  │  ┌──────────────────────┐    ┌──────────────────────────┐    │  │
│  │  │  Zustand uploadStore │    │  TanStack Query (tRPC)   │    │  │
│  │  │  pipeline state only │◄──►│  MediaItem data only     │    │  │
│  │  │  (status, progress,  │ id │  (price, date, resource) │    │  │
│  │  │   mediaId, abort)    │    │                          │    │  │
│  │  └──────────────────────┘    └──────────────────────────┘    │  │
│  └──────────────────────────────────────────────────────────────┘  │
└──────────────────────┬─────────────────────────────────────────────┘
                       │ tRPC
          ┌────────────▼─────────────┐     ┌────────────────┐
          │  server/routes/media.ts  │     │   Cloudinary   │
          │  save · publish · delete │     │   (CDN / XHR)  │
          │  updateBatch · signature │     └────────────────┘
          └──────────────────────────┘
```

---

## File Map

```
src/features/Upload/model/
├── ★ cloudinaryTransport.ts   ← XHR upload to Cloudinary; returns { promise, abort }
│                                 internal to Upload feature (FSD: not shared/)
├── ★ UploadPipeline.ts        ← orchestrates sign → upload → save per file
├── ★ useUploadManager.ts      ← business logic: addFiles, cancel, retry, remove
├── ★ uploadStore.ts           ← Zustand: pipeline state only (no MediaItem data)
│
├── UploadError.ts             ← typed client-side error class (see Error Codes)
├── types.ts                   ← UploadItem, CloudinaryResult, ExifMetadata, QueueItem
├── useUploadQueue.ts          ← joins Zustand + TQ by mediaId → QueueItem[]
├── useDraftEditing.ts         ← price / date / metadata edits
├── useDraftMedia.ts           ← TQ cache for draft MediaItems
└── usePublish.ts              ← publish flow

src/entities/Media/
├── constants.ts               ← MEDIA_CLOUDINARY_TRANSFORMS, MEDIA_UPLOAD_CONFIG
│     THUMBNAIL           → t_wave_atlas_thumbnail        (400×300 crop, no watermark)
│     LIGHTBOX_WATERMARK  → t_wave_atlas_lightbox_watermark (800px, tiled watermark)
│     LIGHTBOX            → t_wave_atlas_lightbox          (800px, no watermark — gated)
├── types.ts                   ← MediaItem
└── mapper.ts                  ← Prisma → MediaItem
```

---

## Item Status Machine

```
             addFiles()
                 │
                 ▼
            ┌─────────┐
            │ pending │
            └────┬────┘
                 │ pipeline starts
                 ▼
            ┌─────────┐
            │ signing │  getSignature
            └────┬────┘
                 │
                 ▼
            ┌──────────┐
            │uploading │  XHR to Cloudinary (0–100%)
            └────┬─────┘
                 │
                 ▼
            ┌────────┐
            │ saving │  tRPC media.create
            └────┬───┘
          ┌──────┴──────┐
          │             │
          ▼             ▼
    ┌──────────┐    ┌───────┐
    │completed │    │ error │ ──► retry() → pending
    └──────────┘    └───────┘
```

---

## Upload Pipeline

One `UploadPipeline` instance per file. Receives `spotId` + `updateItemStatus` callback — **no store import**.

```
                         ┌─ File ─┐
                         │        │
                         ▼        │ on retry: cloudinaryResult
                  [1] extractMetadata          already in Zustand →
                         │                    skip to [4]
                         ▼                         │
                  [2] getSignature                 │
                      tRPC → SignatureData         │
                      type: 'authenticated'        │
                      eager: thumbnail|lightbox_watermark string
                         │                         │
                         ▼                         │
                  [3] uploadToCloud ←──────────────┘
                      cloudinaryTransport.uploadToCloudinary(params)
                      → { promise, abort }
                      abort wired into Zustand before awaiting promise
                      Cloudinary generates eager variants at upload time:
                        eager[0].secure_url → thumbnailUrl  (public)
                        eager[1].secure_url → lightboxUrl   (public, watermarked)
                      Original stored as type: 'authenticated' (private)
                      → stores { publicId, thumbnailUrl, lightboxUrl } in Zustand
                         │
                         ▼
                  [4] saveToDatabase
                      tRPC media.create → MediaItem saved to DB
                         │
                         ▼
                  [5] complete(mediaId)
                      Zustand: status='completed', mediaId set

  AbortError ──► silently dropped (user cancel)
  other error ──► status='error', message stored, notify.error()
```

---

## Data Flows

### Upload

```
User drops files
       │
       ▼
useUploadManager.addFiles()
       ├── validate (type · size · batch limits)
       ├── UploadItem[] → Zustand  (status='pending')
       └── processUpload() × N
                │
                ▼
          UploadPipeline [1→5]
                │
                ▼ success
          Zustand: status='completed', mediaId=<dbId>
          TQ cache: append(MediaItem)          ← immediately visible
                │
                ▼
          useUploadQueue joins Zustand + TQ by mediaId
          → QueueItem with result=MediaItem
          → card shows price/date badges
```

### Metadata Edit (price / date)

```
User edits in toolbar
       │
       ▼
useDraftEditing
       ├── resolve mediaIds  (selectedIds → all completed if empty)
       ├── tRPC media.updateBatch  (server write)
       └── useDraftMediaMutate.update(mediaIds, patch)
                │
                ▼
          TQ cache patched in-place (optimistic, no refetch)
          useUploadQueue re-derives → badges rerender immediately
```

### Publish

```
User clicks Publish
       │
       ▼
usePublish.publishStats
       └── filter: completed + capturedAt + price≥0 + resource.url
       │
       ▼
tRPC media.publish(mediaIds)
       │
       ├── invalidate spots.details + spots.drafts (TQ)
       ├── refetch draftMedia (TQ)
       └── onSuccess(mediaIds)
                │
                ▼
          removeByMediaIds → Zustand items cleared
          onPublishSuccess? → parent (e.g. close drawer)
```

### Remove

```
User removes item
       │
       ├─ in Zustand (active/completed upload)
       │       abort if uploading
       │       tRPC media.delete  (if completed)
       │       Zustand: removeItem
       │       TQ: remove(mediaId)
       │       revokeObjectURL
       │
       └─ in TQ only (server draft, never in Zustand)
               tRPC media.delete
               TQ: remove(id)
               invalidate myDraftCounts
```

---

## Cross-Spot Guard

```
addFiles() called on Spot B
          │
          ▼
   Zustand: any item with status ∉ {completed, error}?
          │
     ┌────┴────┐
    YES        NO
     │          │
     ▼          ▼
  uploadingSpotId === Spot B?   proceed → setSpotContext(B)
     │
  ┌──┴──┐
 YES    NO
  │      │
  ▼      ▼
proceed  blocked → return early
         UI: drop zone disabled + tooltip("Uploading to <SpotA>")
```

Both `useUploadBlocking` (reactive, for UI) and `addFiles` (imperative, for races) enforce this rule independently.

---

## Transport Layer — `cloudinaryTransport.ts`

The XHR transport is the only file that communicates directly with Cloudinary's API.

```
uploadToCloudinary(params)
  │
  ├── buildFormData(params)           ← pure, no side effects
  │
  ├── const xhr = new XMLHttpRequest()
  ├── const abort = () => xhr.abort() ← clean const, caller stores before awaiting
  │
  ├── const promise = new Promise(...)
  │     ├── xhr.open / xhr.send
  │     ├── xhr.upload.onprogress  → onProgress(0–100)
  │     ├── xhr.onload             → parseSuccessResponse | parseRejectedResponse
  │     ├── xhr.onerror            → reject(NETWORK_ERROR)
  │     └── xhr.onabort            → reject('Upload cancelled')
  │
  └── return { promise, abort }

parseSuccessResponse(responseText, resolve, reject)
  ├── JSON.parse  ──✗──► INVALID_RESPONSE
  ├── guard eager[0] + eager[1] present  ──✗──► INVALID_RESPONSE
  └── resolve({ publicId, resource_type, thumbnailUrl, lightboxUrl })

parseRejectedResponse(xhr): UploadError
  ├── JSON.parse xhr.responseText
  │     ✓ → use parsed.error.message
  │     ✗ → logger.warn (body logged for diagnostics) + fallback message
  └── return UploadError('CLOUDINARY_REJECTED', message)
```

---

## State Ownership

Two stores. One rule: **Zustand never holds `MediaItem` data.**

```
                    ┌──── mediaId (FK) ───────────────────┐
                    │                                     │
┌───────────────────▼──────────┐    ┌─────────────────────▼──────────────┐
│  Zustand (uploadStore)       │    │  TanStack Query                    │
│                              │    │  key: ['draft-media', spotId]      │
│  UploadItem {                │    │                                    │
│    id          (client uuid) │    │  MediaItem {                       │
│    status      pending →     │    │    id          (DB id = mediaId)   │
│                completed     │    │    price                           │
│    progress    0–100         │    │    capturedAt                      │
│    mediaId?    → DB id       │    │    resource    { url, type }       │
│    cloudinaryResult?         │    │    status      draft | published   │
│      { publicId,             │    │  }                                 │
│        thumbnailUrl,         │    │                                    │
│        lightboxUrl,          │    │  ops: append · remove · update     │
│        resource_type }       │    │       (useDraftMediaMutate)        │
│    abortUpload?              │    │                                    │
│  }                           │    │                                    │
│  sessionTotal / Completed    │    │                                    │
│  uploadingSpotId / Name      │    │                                    │
└──────────────────────────────┘    └────────────────────────────────────┘
                    │                                      │
                    └──────────── useUploadQueue ──────────┘
                                  joins by mediaId
                                  → QueueItem[]  (render-only, never stored)
```

---

## Error Codes — `UploadError`

Client-side error class. Never uses server HTTP error classes (`BadRequestError` etc.).

```
UploadErrorCode
  CLOUDINARY_REJECTED     ← 4xx from Cloudinary (bad params, policy, invalid signature)
  CLOUDINARY_UNAVAILABLE  ← 5xx from Cloudinary (their service error)
  NETWORK_ERROR           ← XHR onerror (never reached Cloudinary)
  INVALID_RESPONSE        ← 2xx but non-JSON body, or eager URLs missing
```

User cancellation is a plain `Error` — not an `UploadError`. Caught and silently dropped by `isUserCancellation()`.

---

## Cloudinary Named Transforms

Transforms are generated as eager variants **at upload time** on the original authenticated asset.

```
THUMBNAIL           t_wave_atlas_thumbnail          → 400×300 crop, no watermark  (public)
LIGHTBOX_WATERMARK  t_wave_atlas_lightbox_watermark  → 800px, tiled watermark      (public)
LIGHTBOX            t_wave_atlas_lightbox             → 800px, no watermark         (gated: owner / purchased)
```

- `THUMBNAIL` + `LIGHTBOX_WATERMARK` are signed in the eager param → generated at upload
- `LIGHTBOX` is applied **server-side only** via `generatePermanentPreviewUrl()` after ownership check
- The original is stored as `type: 'authenticated'` — never directly accessible

> **Dashboard note:** If renaming transforms, create the new name first, deploy code, then delete the old name. Cloudinary does not support renaming.

---

## Key Invariants

| # | Rule | Enforced by |
|---|------|-------------|
| 1 | `MediaItem` data never enters Zustand | `UploadItem` type has no `result` field |
| 2 | `QueueItem` is never stored | computed in `useUploadQueue`, discarded each render |
| 3 | Retry skips Cloudinary re-upload | `cloudinaryResult` cached in Zustand after stage 3 |
| 4 | Session counters are monotonic | increment-only; reset only when queue was empty at batch start |
| 5 | One spot uploads at a time | guard in `addFiles` + `useUploadBlocking` cover both paths |
| 6 | Blob URLs always revoked | `revokeBlobUrl` on every removal path |
| 7 | `selectedIds` === `mediaId` for completed items | `getItemId = item.mediaId ?? item.id` |
| 8 | Transport is Upload-feature-private | `cloudinaryTransport.ts` lives in `features/Upload/model/`, not `shared/` |
| 9 | `abort` wired before awaiting upload promise | `useUploadManager.uploadNewFile` stores abort in Zustand synchronously |
| 10 | Empty eager URLs are a hard failure | `parseSuccessResponse` throws `INVALID_RESPONSE` — never stored as `''` |
