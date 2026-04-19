# Fix Plan: `cloudinary-client.ts` Audit

**File audited:** `src/shared/lib/cloudinary-client.ts`
**Date:** April 16, 2026
**Related files:** `src/features/Upload/model/UploadPipeline.ts`, `src/features/Upload/model/useUploadManager.ts`, `src/features/Upload/model/types.ts`, `src/shared/errors/`, `src/shared/lib/logger.ts`

---

## Dependency Graph

```
Task 1 (move file)
  └── Task 2 (make apiKey/cloudName required)
  └── Task 3 (fix URL constant → derive from param)     depends on Task 2
  └── Task 4 (introduce UploadError class)
        └── Task 5 (replace server error classes)       depends on Task 4
        └── Task 6 (log swallowed parse errors)         depends on Task 4, backlog #33
  └── Task 7 (trim CloudinaryUploadResult)
        └── Task 8 (move mapping + consolidate types)   depends on Task 7
              └── Task 9 (fix silent empty URLs)        depends on Task 8
  └── Task 10 (refactor abort: onAbortRegister → return abort fn) — independent after Task 1
        └── Task 11 (update UploadPipeline + useUploadManager)    depends on Task 10
  └── Task 12 (type: 'authenticated' literal)           — independent after Task 1
```

---

## Stage 1 — Foundation (prerequisite for everything)

### Task 1 — Move file to correct FSD layer
**Depends on:** nothing
**Blocks:** all other tasks

**Problem:** `cloudinary-client.ts` lives in `shared/lib/`, implying it is reusable across features. Its only consumer is `features/Upload/model/UploadPipeline.ts`. It is Upload-feature-specific infrastructure. FSD rule: `shared/` must not be created for a specific feature.

**Fix:** Move `src/shared/lib/cloudinary-client.ts` → `src/features/Upload/model/cloudinaryTransport.ts`. Update the single import in `UploadPipeline.ts`. No other consumers exist.

---

## Stage 2 — Parameter interface correctness (all can proceed after Task 1)

### Task 2 — Make `apiKey` and `cloudName` required parameters
**Depends on:** Task 1
**Blocks:** Task 3

**Problem:** Both are typed as optional (`apiKey?: string`, `cloudName?: string`) with env var fallback inside the function. The caller `UploadPipeline.uploadToCloud()` always provides both — they come directly from the server-signed `CloudinarySignatureData`. There is no valid runtime path where they're absent. The optional typing and fallback are dead code that misrepresents the interface.

**Fix:** Change both to required (`apiKey: string`, `cloudName: string`). Remove the env var fallback inside the function. Remove the early throw for missing config — it can never trigger.

### Task 3 — Derive upload URL from `cloudName` param instead of env var
**Depends on:** Task 2
**Blocks:** nothing

**Problem:** The module-level constant `CLOUDINARY_UPLOAD_URL` is built from `import.meta.env.VITE_CLOUDINARY_CLOUD_NAME` at module load time. After Task 2, `cloudName` is guaranteed to be present as a param on every call, and it is the authoritative value (signed by the server). If env var and param ever differ, the URL silently uses the env var — ignoring the signed value.

**Fix:** Remove the module-level constant. Derive the URL inline from the `cloudName` param: `` `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload` ``

### Task 12 — Narrow `type` param to literal `'authenticated'`
**Depends on:** Task 1
**Blocks:** nothing

**Problem:** `type: string` accepts any value. The server always signs with `type: 'authenticated'` — no other value is valid. The loose type gives callers a false impression of flexibility.

**Fix:** Change `type: string` → `type: 'authenticated'` in `CloudinaryUploadParams`. This aligns with `CloudinarySignatureData` on the server which already uses `type: 'authenticated' as const`.

---

## Stage 3 — Error handling (can proceed after Task 1)

### Task 4 — Introduce `UploadError` class
**Depends on:** Task 1
**Blocks:** Task 5, Task 6

**Problem:** The file currently imports and throws `BadRequestError`, `BadGatewayError`, `InternalServerError`, `ServiceUnavailableError` from `shared/errors`. These are server-side HTTP error primitives (encoding status codes 400, 502, 500, 503). Using them in a browser-side XHR module is semantically wrong — a browser is not a gateway, and there is no server sending a 500. Callers that catch and inspect the error class receive misleading information.

**Fix:** Create `src/features/Upload/model/UploadError.ts` with a typed `code` field:
- `CLOUDINARY_REJECTED` — 4xx response from Cloudinary (invalid params, policy rejection)
- `CLOUDINARY_UNAVAILABLE` — 5xx response from Cloudinary
- `NETWORK_ERROR` — XHR `onerror` event
- `INVALID_RESPONSE` — 2xx but response body is not valid JSON

This class stays in the Upload feature — it is not a shared concern.

### Task 5 — Replace server error classes with `UploadError`
**Depends on:** Task 4
**Blocks:** nothing

**Fix per throw site:**
- `InternalServerError` (config missing) → removed by Task 2 (can never happen after params required)
- `InternalServerError` (invalid JSON on 2xx) → `new UploadError('INVALID_RESPONSE', message)`
- `BadRequestError` (4xx) → `new UploadError('CLOUDINARY_REJECTED', message)`
- `BadGatewayError` (non-4xx, non-2xx) → `new UploadError('CLOUDINARY_UNAVAILABLE', message)`
- `ServiceUnavailableError` (network error) → `new UploadError('NETWORK_ERROR', message)`
- `new Error('Upload cancelled')` and `new Error('Upload cancelled by user')` — keep as plain `Error`, cancellation is not an upload failure

After this task, remove the `shared/errors` import from `cloudinaryTransport.ts` entirely.

### Task 6 — Log swallowed parse errors in 4xx handler
**Depends on:** Task 4, and backlog #33 (logger.ts) implemented
**Blocks:** nothing

**Problem:** In the 4xx branch, `JSON.parse(xhr.responseText)` is wrapped in a try/catch that discards the parse failure silently. If Cloudinary returns non-JSON (e.g. an HTML error page from a CDN), the raw `responseText` — which could explain the failure — is lost. The caller gets a generic message with no diagnostic value. (See also backlog #17.)

**Fix:** In the catch block, call `logger.warn('[cloudinaryTransport] Non-JSON response from Cloudinary', { status: xhr.status, body: xhr.responseText })` before falling through to the default message.

---

## Stage 4 — Type consolidation (can proceed after Task 1)

### Task 7 — Trim unused fields from `CloudinaryUploadResult`
**Depends on:** Task 1
**Blocks:** Task 8

**Problem:** `CloudinaryUploadResult` models 12 fields from the raw Cloudinary HTTP response. Only 3 are ever consumed: `public_id`, `resource_type`, `eager`. The remaining 9 (`version`, `signature`, `width`, `height`, `format`, `created_at`, `bytes`, `url`, `secure_url`, `original_filename`) are modeled but never read. Of these, `url` (non-HTTPS) is actively dangerous — its presence invites accidental use of an insecure URL.

**Fix:** Reduce `CloudinaryUploadResult` to only the fields actually consumed. Remove `url` entirely. Keep `public_id`, `resource_type`, `eager`.

### Task 8 — Move mapping into transport, unexport `CloudinaryUploadResult`
**Depends on:** Task 7
**Blocks:** Task 9

**Problem:** `UploadPipeline.uploadToCloud()` currently maps raw Cloudinary fields to `CloudinaryResult` inline: extracts `eager[0]`, `eager[1]`, renames `public_id` → `publicId`. This mapping is transport-layer knowledge — it knows how Cloudinary structures its eager array. `UploadPipeline` should not contain that knowledge.

Additionally, `CloudinaryUploadResult` is exported from the current file, making it part of the module's public API. It is a transport implementation detail that should never be referenced by name outside `cloudinaryTransport.ts`.

**Fix:**
- Move the `eager[0]` / `eager[1]` mapping into `cloudinaryTransport.ts` so `uploadToCloudinary()` returns `CloudinaryResult` directly
- Make `CloudinaryUploadResult` unexported (lowercase `interface` or prefix with `_`)
- `UploadPipeline.uploadToCloud()` becomes a simple pass-through: call transport, return result

### Task 9 — Guard against missing eager transforms (silent empty URL risk)
**Depends on:** Task 8
**Blocks:** nothing

**Problem:** If Cloudinary returns no eager transforms (e.g. a transform name was renamed/deleted in the Cloudinary dashboard, or the transform failed silently), the current mapping is:
```
thumbnailUrl: eager[0]?.secure_url ?? ''
lightboxUrl:  eager[1]?.secure_url ?? ''
```
Empty strings are stored in the DB as valid URLs. The media item appears to save correctly, but shows broken images. No error is thrown, no warning is logged. The failure is invisible.

**Fix:** After moving the mapping into transport (Task 8), throw `UploadError('INVALID_RESPONSE', ...)` if `eager` is missing or either transform URL is empty. A misconfigured transform is a hard failure, not a graceful degradation.

---

## Stage 5 — Abort API redesign

### Task 10 — Change abort pattern: `onAbortRegister` → return `abort` function
**Depends on:** Task 1
**Blocks:** Task 11

**Problem:** The current pattern uses an inversion of control: the transport calls *back into the caller* via `onAbortRegister(abortFn)` to hand over the abort capability. This forces the caller (`useUploadManager`) to wire the abort function into Zustand via `store.updateItem(id, { abortUpload: abortFn })` inside a callback that fires mid-Promise execution — a side effect triggered from inside the transport layer.

The idiomatic pattern is to give the caller control upfront:
```ts
// Caller creates controller before upload starts
const { promise, abort } = uploadToCloudinary(params);
store.updateItem(id, { abortUpload: abort }); // wired by caller, not transport
const result = await promise;
```

This mirrors the `AbortController` pattern from the browser platform and removes all Zustand coupling from inside `cloudinaryTransport.ts`.

**Fix:** Change `uploadToCloudinary()` return type from `Promise<CloudinaryResult>` to `{ promise: Promise<CloudinaryResult>; abort: () => void }`. Remove `onAbortRegister` from `CloudinaryUploadParams`.

### Task 11 — Update `UploadPipeline` and `useUploadManager` to use new abort API
**Depends on:** Task 10
**Blocks:** nothing

**`UploadPipeline.uploadToCloud()`:**
- Remove `onAbortRegister` parameter
- Destructure `{ promise, abort }` from transport call
- Return both to the caller or wire abort up the call chain

**`useUploadManager` (`uploadNewFile` / `processUpload`):**
- Receive `abort` from the pipeline
- Call `store.updateItem(id, { abortUpload: abort })` directly in the manager — where it belongs
- Remove the `onAbortRegister` callback threading through the call chain

---

## Execution Order Summary

| Task | What | Depends on |
|---|---|---|
| 1 | Move file to `features/Upload/model/cloudinaryTransport.ts` | — |
| 2 | Make `apiKey`, `cloudName` required; remove fallback | 1 |
| 3 | Derive URL from `cloudName` param | 2 |
| 4 | Create `UploadError` class | 1 |
| 5 | Replace server error classes with `UploadError` | 4 |
| 6 | Log swallowed parse errors | 4, backlog #33 |
| 7 | Trim unused fields from raw response type | 1 |
| 8 | Move mapping into transport; unexport raw type | 7 |
| 9 | Guard against missing eager transforms | 8 |
| 10 | Change abort: `onAbortRegister` → `{ promise, abort }` | 1 |
| 11 | Update `UploadPipeline` + `useUploadManager` for new abort API | 10 |
| 12 | Narrow `type` param to `'authenticated'` literal | 1 |

**Parallel groups after Task 1:**
- Tasks 2→3 (param cleanup chain)
- Tasks 4→5→6 (error handling chain)
- Tasks 7→8→9 (type consolidation chain)
- Tasks 10→11 (abort redesign chain)
- Task 12 (standalone)

Total scope: 1 file moved, `cloudinaryTransport.ts` rewritten, `UploadPipeline.ts` simplified, `useUploadManager.ts` abort wiring moved, `types.ts` unchanged, new `UploadError.ts` file.
