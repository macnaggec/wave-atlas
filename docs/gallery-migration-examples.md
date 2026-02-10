# Gallery Migration Examples

This document shows how to migrate from `withSelect(Gallery)` to the new slot-based architecture.

---

## Example 1: Public Gallery (Spot Drawer)

### Before (HOC Pattern)
```tsx
'use client';

import { useMemo, useCallback } from 'react';
import { Text } from '@mantine/core';
import Gallery from 'widgets/Gallery'; // withSelect(Gallery)
import { MediaItem } from 'entities/Media/types';

export function GalleryTab() {
  const { spotData } = useSpotDrawerContext();

  const galleryMedia: MediaItem[] = useMemo(() =>
    spotData?.media.map(transformToMediaItem) || [],
    [spotData]
  );

  const renderMenuActions = useCallback((selectedIds: string[]) => (
    <Text size="sm">Selected: {selectedIds.length}</Text>
  ), []);

  return (
    <Gallery
      media={galleryMedia}
      renderMenuActions={renderMenuActions}
    />
  );
}
```

### After (Slot-Based Pattern)
```tsx
'use client';

import { useMemo } from 'react';
import { Text, Menu } from '@mantine/core';
import { Gallery, SelectionToolbar, PublicCard } from 'widgets/Gallery';
import { useGallerySelection } from 'shared/hooks/gallery';
import { MediaItem } from 'entities/Media/types';

export function GalleryTab() {
  const { spotData } = useSpotDrawerContext();

  const galleryMedia: MediaItem[] = useMemo(() =>
    spotData?.media.map(transformToMediaItem) || [],
    [spotData]
  );

  // Extract selection logic to hook
  const selection = useGallerySelection({
    items: galleryMedia,
    getId: (item) => item.id,
  });

  // Define bulk actions handler
  const handleAddToCart = (items: MediaItem[]) => {
    // Bulk add to cart logic
  };

  return (
    <Gallery
      items={galleryMedia}
      // Toolbar slot: selection controls + actions menu
      toolbar={
        <SelectionToolbar
          selection={selection}
          renderActions={(items) => (
            <Menu.Item onClick={() => handleAddToCart(items)}>
              Add {items.length} to Cart
            </Menu.Item>
          )}
        />
      }
      // Render card with selection state
      renderCard={(item) => (
        <PublicCard
          mediaItem={item}
          actions={['cart', 'favorites']}
          selected={selection.isSelected(item.id)}
          onClick={() => selection.toggle(item.id)}
        />
      )}
      // Empty state slot
      emptyState={
        <Text c="dimmed" fs="italic">No media uploaded yet.</Text>
      }
    />
  );
}
```

**Benefits**:
- ✅ Selection logic reusable via hook
- ✅ Clear separation: toolbar vs. cards
- ✅ PublicCard composable across galleries

---

## Example 2: Upload Tab (Draft Gallery with Validation)

### Before (Base Gallery + DraftMediaCard)
```tsx
'use client';

import GalleryComponent from 'widgets/Gallery/Gallery'; // Base, no HOC
import DraftMediaCard from 'widgets/Gallery/MediaCard/DraftMediaCard';

export function UploadQueue({ items, onRemove }) {
  const draftMedia = useMemo(() =>
    items.filter(i => i.status === 'completed').map(i => i.result),
    [items]
  );

  return (
    <GalleryComponent
      media={draftMedia}
      renderCard={(item) => (
        <DraftMediaCard
          mediaItem={item}
          showValidation={true}
        />
      )}
    />
  );
}
```

### After (Slot-Based with Validation Hook)
```tsx
'use client';

import { useMemo } from 'react';
import { Gallery, DraftCard, BulkEditToolbar, AddFileCard } from 'widgets/Gallery';
import { useGallerySelection } from 'shared/hooks/gallery';
import { useUploadValidation } from 'features/Upload/hooks';

export function UploadQueue({ items, onRemove, addFiles }) {
  const draftMedia = useMemo(() =>
    items.filter(i => i.status === 'completed').map(i => i.result),
    [items]
  );

  // Selection for bulk editing
  const selection = useGallerySelection({
    items: draftMedia,
    getId: (item) => item.id,
  });

  // Validation for red borders
  const validation = useUploadValidation({
    items: draftMedia,
    rules: { requireDate: true, requirePrice: false },
  });

  // Bulk edit handlers
  const handleBulkDateEdit = (ids: string[], date: Date) => {
    // Update date for all selected items
  };

  const handleBulkPriceEdit = (ids: string[], price: number) => {
    // Update price for all selected items
  };

  return (
    <Gallery
      items={draftMedia}
      // Prepend slot: AddFileCard as first item
      prepend={<AddFileCard onFilesSelected={addFiles} />}
      // Toolbar slot: Bulk edit controls when items selected
      toolbar={
        selection.hasSelection ? (
          <BulkEditToolbar
            selectedIds={Array.from(selection.selectedIds)}
            onBulkDateEdit={handleBulkDateEdit}
            onBulkPriceEdit={handleBulkPriceEdit}
          />
        ) : null
      }
      // Render card with validation and selection
      renderCard={(item) => (
        <DraftCard
          mediaItem={item}
          validation={validation.validate(item.id)}
          selected={selection.isSelected(item.id)}
          onClick={() => selection.toggle(item.id)}
          onDateEdit={(id, date) => {/* update single item */}}
          onPriceEdit={(id, price) => {/* update single item */}}
        />
      )}
    />
  );
}
```

**Benefits**:
- ✅ Validation logic in dedicated hook (business layer)
- ✅ Bulk editing with proper toolbar UI
- ✅ AddFileCard via prepend slot (Gallery agnostic)
- ✅ Individual + bulk editing supported

---

## Example 3: Cart Page (Simple Selection + Remove)

### Before (HOC Pattern)
```tsx
import Gallery from 'widgets/Gallery'; // withSelect(Gallery)

export function CartPage() {
  const { cartItems } = useCartContext();

  const renderMenuActions = useCallback((selectedIds: string[]) => (
    <Menu.Item onClick={() => removeFromCart(selectedIds)}>
      Remove Selected
    </Menu.Item>
  ), []);

  return (
    <Gallery
      media={cartItems}
      renderMenuActions={renderMenuActions}
    />
  );
}
```

### After (Slot-Based Pattern)
```tsx
import { Gallery, SelectionToolbar, PublicCard } from 'widgets/Gallery';
import { useGallerySelection } from 'shared/hooks/gallery';

export function CartPage() {
  const { cartItems, removeFromCart } = useCartContext();

  const selection = useGallerySelection({
    items: cartItems,
    getId: (item) => item.id,
  });

  return (
    <Gallery
      items={cartItems}
      toolbar={
        <SelectionToolbar
          selection={selection}
          renderActions={(items) => (
            <Menu.Item
              color="red"
              onClick={() => {
                removeFromCart(items.map(i => i.id));
                selection.clearSelection();
              }}
            >
              Remove {items.length} Items
            </Menu.Item>
          )}
        />
      }
      renderCard={(item) => (
        <PublicCard
          mediaItem={item}
          actions={['remove']}
          selected={selection.isSelected(item.id)}
          onClick={() => selection.toggle(item.id)}
        />
      )}
    />
  );
}
```

---

## Key Pattern Differences

| Aspect | Old (HOC) | New (Slot-Based) |
|--------|-----------|------------------|
| **Selection State** | Internal to HOC | `useGallerySelection` hook |
| **Menu Actions** | `renderMenuActions(ids)` callback | `renderActions(items)` in `<SelectionToolbar>` |
| **Card Customization** | `renderCard?(item)` | `renderCard(item, context)` required |
| **Special Cards** | Not supported | `prepend` slot (e.g., AddFileCard) |
| **Validation** | Props on DraftMediaCard | `useUploadValidation` hook + BaseCard |
| **Filtering** | External to Gallery | `useGalleryFilters` hook |
| **Empty State** | Inline conditional | `emptyState` slot |

---

## Migration Checklist

- [ ] Replace `import Gallery from 'widgets/Gallery'` → `import { Gallery } from 'widgets/Gallery'`
- [ ] Add `useGallerySelection` hook for selection state
- [ ] Replace `renderMenuActions` → `<SelectionToolbar renderActions={...} />`
- [ ] Change `media={items}` → `items={items}`
- [ ] Update `renderCard` to accept `(item, context)` signature
- [ ] Add `toolbar`, `prepend`, `emptyState` slots as needed
- [ ] For upload tab: Add `useUploadValidation` hook
- [ ] For public galleries: Use `PublicCard` with `actions` prop
- [ ] Test selection + bulk actions work correctly
- [ ] Remove dependency on `withSelect` HOC

---

*Generated: February 5, 2026*
