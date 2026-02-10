# Draft-to-Publish Workflow - Implementation Progress

**Feature:** Media Draft Management with EXIF Metadata Extraction
**Started:** February 1, 2026
**Status:** IN PROGRESS (Phase 1: Infrastructure & Bulk Editing)

---

## 📋 Overview

Implementing a draft-to-publish workflow for photographers to upload media, set prices/dates, validate metadata, and publish to their portfolio.

### Key User Flows
1. **Upload**: Photos/videos saved as DRAFTS with EXIF-extracted dates
2. **Review**: Photographer sees drafts with metadata overlay (price, date, validation state)
3. **Bulk Edit**: Apply prices/dates to multiple items efficiently (separate controls)
4. **Individual Edit**: Click draft card → modal with preview + metadata form
5. **Publish**: Batch publish validated drafts to public gallery

---

## 🏗️ Architecture Decisions

### 1. SSR Strategy: Conditional + Lazy Loading
**Decision:** Hybrid approach instead of pure SSR or pure client-side

**Rationale:**
- Home page load with no `spotId`: No draft fetch (zero waste)
- Direct URL with `spotId`: SSR fetch drafts (no loading spinner)
- Map click opens drawer: Client-side lazy load when Upload tab opens

**Implementation:**
- `app/(main)/page.tsx`: Conditional SSR `spotId ? getDraftMedia() : []`
- `useUploadManager`: Accepts `initialDrafts` + `isTabActive` for lazy loading
- `SpotDrawer`: Passes `isUploadTabActive` to trigger client fetch

**Benefits:**
- ✅ No wasted DB queries on home page
- ✅ Instant load for bookmarked URLs
- ✅ Fast drawer opening (gallery shows first)
- ✅ Acceptable 200-500ms spinner when switching to Upload tab

### 2. Bulk Edit UX: Separate Price/Date Controls
**Decision:** Individual apply buttons for price and date (not combined)

**Rationale:**
- **Granular control**: Can set all prices without touching EXIF dates
- **Reduced risk**: Prevents accidental date overwrites
- **Clear intent**: "Apply Price to 3 Items" is unambiguous
- **Flexible workflow**: Set prices first, then manually fix dates for items missing EXIF

**Industry validation:**
- Excel/Sheets: Fill columns independently ✅
- Lightroom: Sync exposure without syncing white balance ✅
- Photoshop: Apply layer properties separately ✅

**Implementation:**
```
┌─────────────────────────────────────────┐
│ Price: [$15.00]  [Apply to All (12)]   │
│ Date:  [Dec 15]  [Apply to 3 Items]    │
└─────────────────────────────────────────┘
```

### 3. Card Component Pattern: Specialized over HOC
**Decision:** Create `DraftMediaCard` and `EditableMediaCard` (future) instead of HOC wrapper

**Rationale:**
- **SOLID compliance**: Single Responsibility Principle (each card one purpose)
- **Maintainability**: Clear separation of concerns
- **Type safety**: Props specific to each use case
- **Performance**: No nested HOC render overhead

**Implementation:**
- `MediaCard`: Base component (image/video rendering)
- `DraftMediaCard`: Extends base with metadata overlay, validation UI
- `EditableMediaCard` (planned): Extends base for published items with edit icon

### 4. Metadata Form Pattern: Modal vs Inline
**Decision:**
- **Bulk operations**: Persistent toolbar (no modal)
- **Single edit**: Modal with preview panel

**Rationale:**
- Bulk: User needs to see all items while applying changes (Gmail/Drive pattern)
- Single: Focused editing with visual context (Lightroom/Instagram pattern)

### 5. Server Actions: Separate Draft Updates from Publishing
**Decision:** `updateDraftMetadata()` separate from `publishMediaItems()`

**Rationale:**
- **Clear intent**: Draft edits don't change publication status
- **Validation**: Can update drafts without meeting publish requirements
- **Caching**: Draft updates don't invalidate public gallery cache
- **Rollback**: Easier to revert draft changes without affecting published state

---

## ✅ Completed Components

### 1. Database Schema Migration
**File:** `prisma/schema.prisma`

```prisma
enum MediaStatus {
  DRAFT
  PUBLISHED
  DELETED
}

model MediaItem {
  status    MediaStatus @default(DRAFT)
  deletedAt DateTime?
}
```

**Migration:** `20260201121217_add_media_status_enum`
**Status:** ✅ Applied successfully

### 2. EXIF Extraction
**File:** `src/shared/lib/exifExtractor.ts`

**Features:**
- Extracts `DateTimeOriginal`, `CreateDate`, `ModifyDate` (with fallback hierarchy)
- Extracts GPS coordinates (latitude/longitude)
- Extracts camera info (make/model)
- Tracks `dateSource: 'exif' | 'fallback'` for UI badge

**Dependencies:** `exifr@7.1.3` (supports .jpg, .tif, .png, .heic, .avif)

**Integration:** Called in `useUploadManager` before `createMediaItem`

### 3. Server Actions
**File:** `src/app/actions/media.ts`

#### `updateDraftMetadata()`
```typescript
// Updates price and/or date for drafts without publishing
{
  mediaIds: z.array(z.uuid()),
  price: z.number().min(0).optional(),
  capturedAt: z.coerce.date().optional()
}
```

**Validation:**
- Ownership check via `mediaAuthService.ensureCanModify()`
- Draft status check (throws if not DRAFT)
- At least one field required (price OR date)

#### `getDraftMedia()`
- Fetches user's drafts (filtered by `user.id` and `status: DRAFT`)
- Used for SSR and client-side lazy loading

#### `publishMediaItems()` (existing, not modified)
- Publishes drafts to PUBLISHED status
- Optionally updates price/date during publish

### 4. DraftMediaCard Component
**File:** `src/widgets/Gallery/MediaCard/DraftMediaCard.tsx`

**Features:**
- Metadata overlay (price, date) with gradient background
- "Auto" badge when `dateSource === 'exif'`
- "Missing Date" badge when `!capturedAt`
- Red pulsing border for validation errors
- Blue outline when selected (via withSelect HOC)
- Hover elevation effect

**CSS Module:** Clean separation of styling

### 5. BulkEditToolbar Component
**File:** `src/features/Upload/BulkEditToolbar/BulkEditToolbar.tsx`

**Features:**
- Separate price/date inputs with individual buttons
- Dynamic button text based on selection:
  - 0 selected: "Apply to All (12 drafts)"
  - 3 selected: "Apply to 3 Items"
- Confirmation modal for "Apply to All" (prevents accidents)
- Direct apply for selected items (no confirmation)
- Clean code: All handlers extracted with `useCallback`, CSS modules

**Subcomponents:**
- `ConfirmationModal`: Reusable confirmation dialog with loading state

### 6. Hybrid SSR Implementation
**Files Modified:**
- `app/(main)/page.tsx`: Conditional SSR based on `spotId`
- `src/features/Upload/useUploadManager.ts`: Added `isTabActive` + lazy loading logic
- `src/features/Upload/SpotUploadPanel.tsx`: Loading state for client fetch
- `src/widgets/SpotDrawer/SpotDrawer.tsx`: Tracks `isUploadTabActive`

**Flow:**
```
Page load without spotId → No fetch
Page load with spotId → SSR fetch → initialDrafts passed down
Map click → Drawer opens → Upload tab clicked → Client fetch starts
```

---

## 🚧 In Progress (Blocked)

### UploadQueue Integration
**File:** `src/features/Upload/UploadQueue.tsx`
**Status:** ⚠️ CORRUPTED FILE - needs clean rewrite

**Intended Changes:**
1. Import `BulkEditToolbar` and `updateDraftMetadata`
2. Add `useState` for `selectedIds` tracking
3. Wire up `renderMenuActions` to update parent state
4. Implement `handleApplyPrice` and `handleApplyDate` with:
   - `useTransition` for pending state
   - Success/error notifications
   - Selection clearing after success

**Blocker:** File corruption from multi-replacement. Needs fresh implementation.

**Recommended Approach for Next Session:**
```typescript
// 1. Track selection in parent component
const [selectedIds, setSelectedIds] = useState<string[]>([]);

// 2. Pass to Gallery via renderMenuActions callback
renderMenuActions={(ids) => {
  setSelectedIds(ids); // Update parent state
  return <Text>{ids.length} selected</Text>;
}}

// 3. Use in BulkEditToolbar
<BulkEditToolbar
  selectedCount={selectedIds.length}
  onApplyPrice={(price) => {
    const targets = selectedIds.length > 0 ? selectedIds : allDraftIds;
    await updateDraftMetadata({ mediaIds: targets, price });
  }}
/>
```

---

## 📝 TODO: Remaining Features

### Phase 2: Individual Edit Modal (Chunk 2D)
**Component:** `DetailModal` (modify existing `MetadataForm`)

**Design:**
```
┌──────────────────────────────────────┐
│  Edit Draft              [×]         │
├───────────────┬──────────────────────┤
│               │  Price: [$    ]      │
│  [Preview]    │  Date:  [📅    ]     │
│  Image/Video  │                      │
│               │        [Save]        │
└───────────────┴──────────────────────┘
```

**Requirements:**
- Left: Image/video preview (full height)
- Right: Price/date form (existing MetadataForm reused)
- Triggered by clicking `DraftMediaCard` in gallery
- Single "Save" button (not "Apply to N")

### Phase 3: Validation UI
**Features:**
1. Red border on `DraftMediaCard` when `!capturedAt`
2. Error banner as divider:
   ```
   ⚠️ Cannot publish: 3 items missing dates
   ```
3. Disabled "Publish" button until all items valid
4. Blue "Auto" badge for `dateSource === 'exif'`

### Phase 4: Publish Flow
**Component:** Publish button in toolbar

**Requirements:**
1. Validate all drafts have required fields
2. Show confirmation modal with summary:
   ```
   Publish 12 items?
   • 8 priced at $15.00
   • 4 free items
   ```
3. Call `publishMediaItems({ mediaIds, price?, capturedAt? })`
4. Invalidate cache via `revalidatePath`
5. Show success notification
6. Clear upload queue

### Phase 5: EXIF Overwrite Warning
**Trigger:** Bulk "Apply Date to All" when items have `dateSource === 'exif'`

**Modal:**
```
⚠️ Overwrite Auto-Detected Dates?

5 items have dates from EXIF metadata.
Applying a manual date will replace them.

[Cancel] [Yes, Apply]
```

### Phase 6: Portfolio Page SSR
**File:** `app/(main)/uploads/page.tsx` (create)

**TODO comment added:**
```typescript
// TODO (SSR): Create app/(main)/uploads/page.tsx route that:
//   1. Fetches getUserMedia() server-side
//   2. Passes initialMedia prop to this component
//   3. Add isTabActive prop for lazy loading if needed
```

---

## 🎯 Design Principles Applied

### Performance
- ✅ Conditional SSR (no wasted queries)
- ✅ Lazy loading (only when needed)
- ✅ `useCallback` for all handlers (prevent re-renders)
- ✅ `useMemo` for expensive computations
- ✅ CSS modules (no inline styles)

### User Experience
- ✅ No loading spinners for direct URLs (SSR)
- ✅ Confirmation for destructive operations
- ✅ Clear button text ("Apply to 3 Items")
- ✅ Contextual information ("12 drafts")
- ✅ Visual feedback (red borders, badges, animations)

### Code Quality
- ✅ Clean separation of concerns (FSD layers)
- ✅ No inline handlers or styles
- ✅ Single Responsibility Principle (specialized cards)
- ✅ Type safety (TypeScript, Zod schemas)
- ✅ Error handling (try/catch, notifications)

### Security
- ✅ Ownership validation (`ensureCanModify`)
- ✅ Status validation (only update drafts)
- ✅ Protected Server Actions (`createProtectedAction`)
- ✅ User-scoped queries (filter by `user.id`)

---

## 📊 Metrics & Limits (MVP)

### Upload Limits (Cloudinary Free Tier)
- Image: 10MB max
- Video: 50MB max
- Batch: 20 files, 200MB total
- Daily: 100 uploads/day

### Database
- Soft delete: `deletedAt` timestamp (30-day grace period)
- Status enum: `DRAFT | PUBLISHED | DELETED`
- Draft retention: Indefinite (until published or deleted)

---

## 🔄 Next Session Checklist

1. **Fix UploadQueue** - Rewrite integration cleanly
2. **Test bulk operations** - Verify price/date updates work
3. **Build DetailModal** - Single edit with preview
4. **Add validation UI** - Red borders, error banner
5. **Implement publish flow** - Batch publish with validation
6. **Add EXIF warning** - Date overwrite confirmation

---

## 📚 References

### Files Modified
- `prisma/schema.prisma`
- `src/shared/lib/exifExtractor.ts`
- `src/app/actions/media.ts`
- `src/entities/Media/constants.ts`
- `src/entities/Media/types.ts`
- `src/features/Upload/useUploadManager.ts`
- `src/features/Upload/SpotUploadPanel.tsx`
- `src/features/Upload/UploadQueue.tsx` ⚠️
- `app/(main)/page.tsx`
- `src/views/HomePage/ui/HomePage.tsx`
- `src/widgets/SpotDrawer/SpotDrawer.tsx`

### Files Created
- `src/shared/lib/exifExtractor.ts`
- `src/widgets/Gallery/MediaCard/DraftMediaCard.tsx`
- `src/widgets/Gallery/MediaCard/DraftMediaCard.module.css`
- `src/features/Upload/BulkEditToolbar/BulkEditToolbar.tsx`
- `src/features/Upload/BulkEditToolbar/BulkEditToolbar.module.css`
- `src/features/Upload/BulkEditToolbar/ConfirmationModal.tsx`
- `src/features/Upload/BulkEditToolbar/index.ts`
- `src/features/Upload/MetadataForm/MetadataForm.tsx`
- `src/features/Upload/MetadataForm/index.ts`

### Dependencies Added
- `@mantine/dates@8.3.11`
- `dayjs` (peer dependency)
- `exifr@7.1.3`

---

**Last Updated:** February 1, 2026
**Next Review:** After UploadQueue fix and DetailModal implementation
