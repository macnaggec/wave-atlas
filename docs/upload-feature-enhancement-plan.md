# Upload Feature: Enhancement Plan

## Current State (Phase 1 - Baseline)

### Implementation Date
February 4, 2026

### Behavior
- Uploads work within single spot drawer session
- Tab switches within drawer preserve state (`keepMounted` prop)
- **Limitation**: Closing drawer cancels in-progress uploads (with warning)
- **Limitation**: No cross-spot upload tracking

### Architecture
```
SpotDrawerWithData (RSC)
  ↓ fetches draftMedia via getDraftMedia()
  ↓ provides via SpotDrawerContext
SpotUploadPanel (Client Component)
  ↓ local useState for queue
useUploadManager (Hook)
  ↓ manages upload lifecycle
```

**State Location**: Feature layer (local component state)

---

## Phase 2: Global Upload Manager (Future Enhancement)

### User Requirements
1. **Multi-spot exploration** - User can close/open different spot drawers
2. **Persistent uploads** - Uploads continue even when drawer closed
3. **Global progress indicator** - Shows active uploads across all spots
4. **Deep linking** - Click indicator → opens specific spot's upload tab
5. **State synchronization** - Reopening shows current progress while absent

---

## Architecture Changes

### 1. Global State Management

**New File**: `src/shared/services/GlobalUploadService.ts`

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UploadQueue {
  [spotId: string]: UploadItem[];
}

interface GlobalUploadStore {
  queues: UploadQueue;

  // Actions
  addUploads: (spotId: string, files: File[]) => void;
  updateUploadStatus: (spotId: string, uploadId: string, status: UploadStatus) => void;
  removeUpload: (spotId: string, uploadId: string) => void;
  clearCompleted: (spotId: string) => void;

  // Selectors
  getQueueForSpot: (spotId: string) => UploadItem[];
  getActiveUploads: () => { spotId: string; items: UploadItem[] }[];
  hasActiveUploads: (spotId?: string) => boolean;
}

export const useGlobalUploadStore = create<GlobalUploadStore>(
  persist(
    (set, get) => ({
      queues: {},

      addUploads: (spotId, files) => {
        const newItems = files.map(file => ({
          id: uuidv4(),
          spotId,
          file,
          previewUrl: URL.createObjectURL(file),
          status: 'pending',
          progress: 0,
        }));

        set(state => ({
          queues: {
            ...state.queues,
            [spotId]: [...(state.queues[spotId] || []), ...newItems],
          },
        }));

        // Trigger uploads
        newItems.forEach(item => processUpload(spotId, item));
      },

      // ... other actions
    }),
    {
      name: 'upload-storage',
      // Don't persist files, only metadata
      partialize: (state) => ({
        queues: Object.entries(state.queues).reduce((acc, [spotId, items]) => ({
          ...acc,
          [spotId]: items.map(item => ({
            ...item,
            file: null, // Can't persist File objects
          })),
        }), {}),
      }),
    }
  )
);
```

---

### 2. Global Upload Indicator

**New File**: `src/widgets/Header/GlobalUploadIndicator.tsx`

```tsx
'use client';

import { Badge, ActionIcon, Indicator, Popover, Stack, Text, Progress } from '@mantine/core';
import { IconCloudUpload } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useGlobalUploadStore } from 'shared/services/GlobalUploadService';

export function GlobalUploadIndicator() {
  const router = useRouter();
  const activeUploads = useGlobalUploadStore(s => s.getActiveUploads());

  const totalActive = activeUploads.reduce((sum, { items }) =>
    sum + items.filter(i => ['signing', 'uploading', 'saving'].includes(i.status)).length,
    0
  );

  if (totalActive === 0) return null;

  const handleClickSpot = (spotId: string) => {
    router.push(`/${spotId}?tab=upload`);
  };

  return (
    <Popover position="bottom-end" withArrow>
      <Popover.Target>
        <Indicator label={totalActive} size={16}>
          <ActionIcon variant="subtle" size="lg">
            <IconCloudUpload size={20} />
          </ActionIcon>
        </Indicator>
      </Popover.Target>

      <Popover.Dropdown>
        <Stack gap="xs">
          <Text size="sm" fw={600}>Active Uploads</Text>
          {activeUploads.map(({ spotId, items }) => (
            <Stack
              key={spotId}
              gap={4}
              onClick={() => handleClickSpot(spotId)}
              style={{ cursor: 'pointer' }}
            >
              <Text size="xs" fw={500}>{spotId}</Text>
              <Progress
                value={items.reduce((sum, i) => sum + i.progress, 0) / items.length}
                size="xs"
              />
            </Stack>
          ))}
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}
```

**Integration**: Add to `src/widgets/Header/Header.tsx`

---

### 3. Refactor SpotUploadPanel to Consumer

**Modified**: `src/features/Upload/SpotUploadPanel.tsx`

```tsx
export function SpotUploadPanel({ spotId, spotName }: SpotUploadPanelProps) {
  const { draftMedia } = useSpotDrawerContext();

  // Now reads from global store instead of local state
  const queue = useGlobalUploadStore(s => s.getQueueForSpot(spotId));
  const addUploads = useGlobalUploadStore(s => s.addUploads);
  const removeUpload = useGlobalUploadStore(s => s.removeUpload);
  const clearCompleted = useGlobalUploadStore(s => s.clearCompleted);

  const hasActiveUploads = queue.some(i =>
    ['signing', 'uploading', 'saving'].includes(i.status)
  );

  // Initialize queue with server drafts (one-time merge)
  useEffect(() => {
    if (!draftMedia || queue.length > 0) return;

    const draftItems = draftMedia.map(draft => ({
      id: draft.id,
      spotId,
      file: null as any,
      previewUrl: draft.watermarkUrl,
      status: 'completed',
      progress: 100,
      result: draft,
    }));

    // Merge server drafts into global store
    // (implementation detail: store needs mergeDrafts action)
  }, [draftMedia, spotId, queue.length]);

  const handleDrop = useCallback((files: File[]) => {
    addUploads(spotId, files);
  }, [addUploads, spotId]);

  // Rest of component unchanged
}
```

---

### 4. Background Upload Processing

**New File**: `src/shared/services/UploadProcessor.ts`

Extracts upload logic from hook to standalone service that runs independently:

```typescript
export class UploadProcessor {
  private abortControllers = new Map<string, AbortController>();

  async processUpload(spotId: string, item: UploadItem) {
    const controller = new AbortController();
    this.abortControllers.set(item.id, controller);

    try {
      // 1. Extract EXIF
      const exifData = await extractExifData(item.file);

      // 2. Get signature
      useGlobalUploadStore.getState().updateUploadStatus(spotId, item.id, 'signing');
      const signature = await getCloudinarySignature({ ... });

      // 3. Upload to Cloudinary
      useGlobalUploadStore.getState().updateUploadStatus(spotId, item.id, 'uploading');
      const cloudResult = await uploadToCloudinary({
        file: item.file,
        signature,
        signal: controller.signal,
        onProgress: (progress) => {
          useGlobalUploadStore.getState().updateUploadProgress(spotId, item.id, progress);
        },
      });

      // 4. Save to DB
      useGlobalUploadStore.getState().updateUploadStatus(spotId, item.id, 'saving');
      const media = await createMediaItem({ ... });

      // 5. Mark complete
      useGlobalUploadStore.getState().updateUploadComplete(spotId, item.id, media);

    } catch (error) {
      if (error.name === 'AbortError') {
        // Upload cancelled
        useGlobalUploadStore.getState().removeUpload(spotId, item.id);
      } else {
        useGlobalUploadStore.getState().updateUploadError(spotId, item.id, error.message);
      }
    } finally {
      this.abortControllers.delete(item.id);
    }
  }

  cancelUpload(uploadId: string) {
    this.abortControllers.get(uploadId)?.abort();
  }

  cancelAllForSpot(spotId: string) {
    const queue = useGlobalUploadStore.getState().queues[spotId] || [];
    queue.forEach(item => this.cancelUpload(item.id));
  }
}

export const uploadProcessor = new UploadProcessor();
```

---

### 5. Drawer Close Protection (Enhanced)

**Modified**: `src/widgets/SpotDrawer/SpotDrawer.tsx`

```tsx
const hasActiveUploads = useGlobalUploadStore(s => s.hasActiveUploads(spotData?.id));

const handleClose = useCallback(() => {
  if (hasActiveUploads) {
    modals.openConfirmModal({
      title: 'Cancel uploads?',
      children: (
        <Text size="sm">
          You have active uploads. They will continue in the background.
          You can track progress in the upload indicator (top right).
        </Text>
      ),
      labels: { confirm: 'Continue', cancel: 'Stay here' },
      onConfirm: () => {
        // Uploads continue, just close drawer
        router.back();
      },
    });
  } else {
    router.back();
  }
}, [hasActiveUploads, router]);
```

---

## Migration Path

### Step 1: Install Dependencies
```bash
npm install zustand
```

### Step 2: Create Services
1. `GlobalUploadService.ts` - State management
2. `UploadProcessor.ts` - Background processing

### Step 3: Update Components
1. Refactor `useUploadManager` → extract logic to processor
2. Update `SpotUploadPanel` → consume global store
3. Create `GlobalUploadIndicator` widget
4. Add indicator to `Header`

### Step 4: Update Drawer
1. Remove `keepMounted` (no longer needed)
2. Update close handler (remove cancel warning)

### Step 5: Testing
- [ ] Test multi-spot uploads
- [ ] Test drawer close during upload
- [ ] Test navigation during upload
- [ ] Test upload completion notification
- [ ] Test error handling across navigation
- [ ] Test memory cleanup (blob URLs)

---

## Technical Considerations

### Memory Management
- Store must clean up blob URLs when uploads complete
- Persist only metadata, not File objects
- Implement cleanup for abandoned uploads (>24h old)

### Error Recovery
- Failed uploads should be retryable
- Network errors should auto-retry (3 attempts)
- Add "Retry All Failed" action

### Performance
- Limit concurrent uploads (max 3 per spot)
- Queue additional uploads
- Use Web Workers for EXIF extraction

### UX Improvements
- Toast notification on upload completion
- Sound notification (optional)
- Desktop notification API
- Batch upload with folder support

---

## FSD Compliance

**Challenge**: Global state violates feature-layer isolation

**Solution**: Treat uploads as **app-level concern**, not feature:
- Move to `src/app/services/` (not `shared/` or `features/`)
- Upload is cross-cutting like auth or theme
- Components consume via hooks (dependency inversion)

**Layer Structure**:
```
src/
  app/
    services/
      GlobalUploadService.ts  ← New home
  widgets/
    Header/
      GlobalUploadIndicator.tsx
  features/
    Upload/
      SpotUploadPanel.tsx  ← Now just UI
```

---

## Estimated Effort

- **Services Creation**: 3-4 hours
- **Component Refactoring**: 2-3 hours
- **Testing & Debugging**: 2-3 hours
- **Documentation**: 1 hour

**Total**: ~8-12 hours

---

## Decision Point

Implement Phase 2 when:
1. User feedback indicates drawer-closing is disruptive
2. Multi-spot workflows become common
3. Upload volumes justify complexity

**Current**: Phase 1 is sufficient for MVP. Revisit after launch.
