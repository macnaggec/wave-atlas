# Upload Design

## Key Components & Responsibilities
- **UploadTab**: Orchestrates auth gating, state initialization, and renders UploadGallery.
- **UploadGallery**: Merges upload items and drafts into one gallery list; controls overlay selection, actions, and selection behavior.
- **DraftCard**: Upload-specific card wrapper that applies validation visuals and composes BaseCard with overlays.
- **DraftOverlays**: Draft metadata presentation for completed items (date/price/etc.).
- **UploadingOverlays**: Upload progress presentation for in-flight items.
- **BulkEditToolbar**: Batch actions for selected drafts (date/price).
- **BaseCard**: Generic display-only media card with overlay/action slots.

## Data Flow Overview
1. **SpotDrawer Context** provides `spotData` and `draftMedia` to the upload tab.
2. **useUploadManager** initializes with `spotId` and `draftMedia`, producing a unified `UploadItem[]` queue.
3. **UploadGallery** renders the queue:
   - Uploading items use preview URLs and UploadingOverlays.
   - Completed items use Cloudinary URLs and DraftOverlays.
4. **Selection** applies only to completed items for bulk editing.
5. **Actions** (remove/cancel, retry) are bound per item; bulk edits operate on selected IDs.
