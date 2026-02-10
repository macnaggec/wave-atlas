# Feature: Gallery System Refactoring

## Goal
Replace the monolithic `withSelect` HOC with a slot-based Gallery component and composable hooks, enabling independent extension of UI variations (card overlays, toolbars, special cards) and behaviors (selection, filtering, validation) without modifying core Gallery code.

## Context

### Related Files
- [src/widgets/Gallery/Gallery.tsx](../src/widgets/Gallery/Gallery.tsx) - Base gallery component (pure presentation, 67 lines)
- [src/widgets/Gallery/withSelect.tsx](../src/widgets/Gallery/withSelect.tsx) - HOC to be replaced (82 lines)
- [src/widgets/Gallery/MediaCard/](../src/widgets/Gallery/MediaCard/) - Card components
- [src/features/Upload/UploadQueue.tsx](../src/features/Upload/UploadQueue.tsx) - Uses base Gallery with DraftMediaCard
- [src/widgets/SpotDrawer/GalleryTab.tsx](../src/widgets/SpotDrawer/GalleryTab.tsx) - Uses withSelect(Gallery)
- [src/features/Cart/CartPage.tsx](../src/features/Cart/CartPage.tsx) - Uses withSelect(Gallery)
- [src/features/Uploads/UploadsGalleryMenu.tsx](../src/features/Uploads/UploadsGalleryMenu.tsx) - Uses withSelect(Gallery)

### Dependencies
- **Mantine UI 8**: All UI components, hooks (`useDisclosure`, `useListState`)
- **FSD Layers**: Gallery in `widgets/`, validation in `features/`, hooks in `shared/`
- **Next.js 15**: `'use client'` directive, `next/image` optimization
- **TypeScript**: Generic types for card render props

### Blocked By
None - can proceed incrementally without breaking existing galleries during migration.

## Decisions

### [x] Validation Logic Location
**Decision**: Validation logic is business-specific and lives in `features/Upload/hooks/useUploadValidation.ts`.
- **Rationale**: Validation rules ("draft needs date + price") are domain concerns, not gallery presentation concerns.
- **Pattern**: Features can create specialized validation hooks that compose with Gallery via render props.

### [x] AddFileCard Pattern
**Decision**: Gallery doesn't know about AddFileCard. Consumer controls special cards via `items` array or separate slot.
- **Rationale**: Keeps Gallery generic. Upload feature manages AddFileCard as first item in composed UI.
- **Implementation**: Consumer can prepend `<AddFileCard />` before `<Gallery />`, or Gallery accepts optional `prepend` slot prop.

### [x] Card Customization Strategy
**Decision**: Use render props pattern for card overlays and actions.
- **Rationale**: Maximum flexibility - overlays can access item data, support conditional rendering, and compose multiple layers.
- **API**: `renderCard={(item, context) => <Card>{overlays}{actions}</Card>}`

### [x] MVP Scope
**Decision**: Simple foundation with clear extension points. No URL persistence, pagination, or virtualization in v1.
- **Rationale**: Focus on replacing HOC and enabling current use cases. Advanced features can be added via hooks/slots later.
- **Extension Base**: Slot props (`toolbar`, `emptyState`), render props (`renderCard`), composable hooks.

## Implementation Steps

### 1. Create Core Hooks (shared/hooks/gallery/)

**Files to create**:
- [src/shared/hooks/gallery/useGallerySelection.ts](../src/shared/hooks/gallery/useGallerySelection.ts)
- [src/shared/hooks/gallery/useGalleryFilters.ts](../src/shared/hooks/gallery/useGalleryFilters.ts)
- [src/shared/hooks/gallery/index.ts](../src/shared/hooks/gallery/index.ts)

**`useGallerySelection` interface**:
```typescript
interface UseGallerySelectionOptions<T> {
  items: T[];
  getId: (item: T) => string;
  initialSelection?: string[];
}

interface UseGallerySelectionReturn<T> {
  selectedIds: Set<string>;
  selectedItems: T[];
  isSelected: (id: string) => boolean;
  toggle: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  hasSelection: boolean;
}
```

**Replaces**: `withSelect` HOC state management (`selectedMediaIds`, `isSelectMode`)

**`useGalleryFilters` interface**:
```typescript
interface UseGalleryFiltersOptions<T> {
  items: T[];
  filters?: {
    dateRange?: [Date, Date];
    priceRange?: [number, number];
    status?: string[];
  };
  sort?: { key: keyof T; direction: 'asc' | 'desc' };
}

interface UseGalleryFiltersReturn<T> {
  filteredItems: T[];
  activeFilters: number; // count for badge display
}
```

**Use case**: Public gallery date/time filters, upload drafts by status.

---

### 2. Refactor Gallery to Slot-Based Component

**File to modify**: [src/widgets/Gallery/Gallery.tsx](../src/widgets/Gallery/Gallery.tsx)

**New interface**:
```typescript
interface GalleryProps<T = MediaItem> {
  items: T[];

  // Render props for card customization
  renderCard: (item: T, context: CardContext) => ReactNode;

  // Slot props for UI extension
  toolbar?: ReactNode;
  emptyState?: ReactNode;
  prepend?: ReactNode; // For AddFileCard or other special first items

  // Grid configuration
  columns?: { base?: number; sm?: number; md?: number; lg?: number };
  gap?: string | number;

  // Accessibility
  'aria-label'?: string;
}

interface CardContext {
  index: number;
  isFirst: boolean;
  isLast: boolean;
}
```

**Rendering structure**:
```tsx
<Stack gap={gap}>
  {toolbar}
  {prepend}
  <div className={classes.grid} style={{ gridTemplateColumns: ... }}>
    {items.map((item, index) => (
      <div key={getId(item)}>
        {renderCard(item, { index, isFirst: index === 0, isLast: index === items.length - 1 })}
      </div>
    ))}
  </div>
  {items.length === 0 && emptyState}
</Stack>
```

**Changes**:
- Remove modal state (move to card components if needed)
- Remove `onCardClick` prop (cards handle their own interactions)
- Remove default `MediaCard` rendering (consumer always provides `renderCard`)
- Keep responsive grid CSS

---

### 3. Build Card Factory Utilities

**Files to create**:
- [src/widgets/Gallery/cards/BaseCard.tsx](../src/widgets/Gallery/cards/BaseCard.tsx)
- [src/widgets/Gallery/cards/DraftCard.tsx](../src/widgets/Gallery/cards/DraftCard.tsx)
- [src/widgets/Gallery/cards/PublicCard.tsx](../src/widgets/Gallery/cards/PublicCard.tsx)
- [src/widgets/Gallery/cards/AddFileCard.tsx](../src/widgets/Gallery/cards/AddFileCard.tsx)
- [src/widgets/Gallery/cards/index.ts](../src/widgets/Gallery/cards/index.ts)

**`BaseCard` component** (replaces current `MediaCard.tsx`):
```typescript
interface BaseCardProps {
  mediaItem: MediaItem;
  overlays?: ReactNode; // Stacked over image/video
  actions?: ReactNode;  // Positioned bottom-right or context menu
  validation?: { hasError: boolean; message?: string }; // Red border
  selected?: boolean;
  onClick?: () => void;
}
```

**Features**:
- Renders `<Image>` or `<Video>` based on `mediaItem.type`
- Stacks `overlays` in top-left (date/price badges, metadata)
- Positions `actions` in bottom-right (cart icon, favorites, delete)
- Applies red border if `validation.hasError`
- Shows checkbox indicator if `selected`

**`DraftCard` component** (specialized for Upload tab):
```typescript
interface DraftCardProps {
  mediaItem: MediaItem;
  onDateEdit?: (id: string, date: Date) => void;
  onPriceEdit?: (id: string, price: number) => void;
  validation?: { hasError: boolean; message?: string };
  selected?: boolean;
}
```

**Renders**:
```tsx
<BaseCard
  mediaItem={mediaItem}
  overlays={
    <>
      <DateEditPopover value={mediaItem.capturedAt} onApply={(date) => onDateEdit?.(mediaItem.id, date)} />
      <PriceEditPopover value={mediaItem.price} onApply={(price) => onPriceEdit?.(mediaItem.id, price)} />
      {mediaItem.dateSource === 'exif' && <Badge size="xs">Auto</Badge>}
    </>
  }
  validation={validation}
  selected={selected}
/>
```

**`PublicCard` component** (for spot galleries, cart):
```typescript
interface PublicCardProps {
  mediaItem: MediaItem;
  actions?: Array<'cart' | 'favorites' | 'share' | 'report'>;
  onAction?: (action: string, id: string) => void;
  selected?: boolean;
}
```

**`AddFileCard` component** (special card for upload tab):
```typescript
interface AddFileCardProps {
  onFilesSelected: (files: File[]) => void;
  accept?: string; // Default: 'image/*,video/*'
  multiple?: boolean;
}
```

**Renders**: Dashed border card with file input trigger, centered icon + text.

---

### 4. Create Toolbar Components

**Files to create**:
- [src/widgets/Gallery/toolbars/SelectionToolbar.tsx](../src/widgets/Gallery/toolbars/SelectionToolbar.tsx)
- [src/widgets/Gallery/toolbars/FilterToolbar.tsx](../src/widgets/Gallery/toolbars/FilterToolbar.tsx)
- [src/widgets/Gallery/toolbars/BulkEditToolbar.tsx](../src/widgets/Gallery/toolbars/BulkEditToolbar.tsx)
- [src/widgets/Gallery/toolbars/index.ts](../src/widgets/Gallery/toolbars/index.ts)

**`SelectionToolbar`** (replaces `withSelect` button UI):
```typescript
interface SelectionToolbarProps<T> {
  selection: UseGallerySelectionReturn<T>; // Hook return value
  renderActions?: (selectedItems: T[]) => ReactNode; // Menu items
}
```

**Renders**:
```tsx
<Group justify="space-between">
  <Button onClick={selection.hasSelection ? selection.clearSelection : selection.selectAll}>
    {selection.hasSelection ? 'Cancel' : 'Select'}
  </Button>
  {selection.hasSelection && (
    <>
      <Text size="sm">{selection.selectedIds.size} selected</Text>
      <Menu>{renderActions?.(selection.selectedItems)}</Menu>
    </>
  )}
</Group>
```

**`FilterToolbar`** (date range, sort for public galleries):
```typescript
interface FilterToolbarProps {
  onFilterChange: (filters: FilterState) => void;
  filters: FilterState;
}
```

**`BulkEditToolbar`** (date/price editors for upload tab):
```typescript
interface BulkEditToolbarProps {
  selectedIds: string[];
  onBulkDateEdit: (ids: string[], date: Date) => void;
  onBulkPriceEdit: (ids: string[], price: number) => void;
}
```

**Renders**: Two popovers (DateEditPopover, PriceEditPopover) that apply changes to all `selectedIds`.

---

### 5. Create Upload-Specific Validation Hook

**File to create**: [src/features/Upload/hooks/useUploadValidation.ts](../src/features/Upload/hooks/useUploadValidation.ts)

**Interface**:
```typescript
interface UseUploadValidationOptions {
  items: MediaItem[];
  rules?: {
    requireDate?: boolean;
    requirePrice?: boolean;
    requireSpot?: boolean;
  };
}

interface UseUploadValidationReturn {
  validate: (id: string) => { hasError: boolean; messages: string[] };
  validateAll: () => Map<string, { hasError: boolean; messages: string[] }>;
  hasErrors: boolean;
  errorCount: number;
}
```

**Usage** (in UploadQueue):
```tsx
const validation = useUploadValidation({
  items: uploadItems,
  rules: { requireDate: true, requirePrice: false }
});

<Gallery
  items={uploadItems}
  renderCard={(item) => (
    <DraftCard
      mediaItem={item}
      validation={validation.validate(item.id)}
      onDateEdit={handleDateEdit}
      onPriceEdit={handlePriceEdit}
    />
  )}
/>
```

---

### 6. Migrate Existing Galleries

**Migrate GalleryTab.tsx** (Spot drawer - public gallery):
```tsx
const selection = useGallerySelection({ items: mediaItems, getId: (m) => m.id });

<Gallery
  items={mediaItems}
  toolbar={
    <SelectionToolbar
      selection={selection}
      renderActions={(items) => (
        <Menu.Item onClick={() => addToCart(items)}>Add to Cart</Menu.Item>
      )}
    />
  }
  renderCard={(item) => (
    <PublicCard
      mediaItem={item}
      actions={['cart', 'favorites']}
      selected={selection.isSelected(item.id)}
      onAction={handleAction}
    />
  )}
/>
```

**Migrate UploadQueue.tsx** (Upload tab - drafts with validation):
```tsx
const selection = useGallerySelection({ items: uploadItems, getId: (m) => m.id });
const validation = useUploadValidation({ items: uploadItems, rules: { requireDate: true } });

<Stack>
  <AddFileCard onFilesSelected={addFiles} />
  <Gallery
    items={uploadItems}
    toolbar={
      selection.hasSelection ? (
        <BulkEditToolbar
          selectedIds={Array.from(selection.selectedIds)}
          onBulkDateEdit={handleBulkDateEdit}
          onBulkPriceEdit={handleBulkPriceEdit}
        />
      ) : null
    }
    renderCard={(item) => (
      <DraftCard
        mediaItem={item}
        validation={validation.validate(item.id)}
        selected={selection.isSelected(item.id)}
        onDateEdit={handleDateEdit}
        onPriceEdit={handlePriceEdit}
      />
    )}
  />
</Stack>
```

**Migrate CartPage.tsx** (Cart - published items with remove action):
```tsx
const selection = useGallerySelection({ items: cartItems, getId: (m) => m.id });

<Gallery
  items={cartItems}
  toolbar={
    <SelectionToolbar
      selection={selection}
      renderActions={(items) => (
        <Menu.Item color="red" onClick={() => removeFromCart(items)}>
          Remove Selected
        </Menu.Item>
      )}
    />
  }
  renderCard={(item) => (
    <PublicCard
      mediaItem={item}
      actions={['remove']}
      selected={selection.isSelected(item.id)}
    />
  )}
/>
```

---

### 7. Deprecate and Remove HOC

**Files to delete** (after migration complete):
- [src/widgets/Gallery/withSelect.tsx](../src/widgets/Gallery/withSelect.tsx)
- [src/widgets/Gallery/withSelect.module.css](../src/widgets/Gallery/withSelect.module.css)
- [src/widgets/Gallery/SelectMenu.tsx](../src/widgets/Gallery/SelectMenu.tsx)

**Update** [src/widgets/Gallery/index.ts](../src/widgets/Gallery/index.ts):
```typescript
// Old: export { default } from './withSelect';
export { default as Gallery } from './Gallery';
export * from './cards';
export * from './toolbars';
```

---

### 8. Document Architecture

**File to create/update**: This file ([docs/gallery-architecture.md](../docs/gallery-architecture.md))

**Sections to add**:
- **Slot Pattern Guide**: How to use `toolbar`, `prepend`, `emptyState` slots
- **Render Props Pattern**: How `renderCard` receives item + context
- **Hook Composition**: Example of combining `useGallerySelection` + `useUploadValidation`
- **Card Factory Guide**: When to use BaseCard vs. specialized cards
- **Extension Examples**: Adding new toolbar types, new card overlays, new validation rules

## Constraints

### Non-Negotiable Requirements
1. **FSD Layer Rules**: Gallery (widgets) cannot import from features or other widgets. Toolbars must be generic.
2. **Mantine UI First**: All UI components use Mantine. CSS Modules only for custom layout.
3. **Server Actions**: All mutations (bulk edit, delete, publish) via Server Actions, not client API calls.
4. **TypeScript Strict**: No `any` types without explicit justification. Generic types for `renderCard` props.
5. **Performance**: `memo` on cards, `useCallback` on handlers, `useMemo` on filtered arrays (>20 items).
6. **Accessibility**: Gallery has `role="grid"`, cards have `role="gridcell"`, proper ARIA labels.

### Technical Constraints
- **React 18+**: Use concurrent features (`useTransition` for mutations, `useDeferredValue` for filters if needed).
- **Next.js 15**: All Gallery code requires `'use client'` directive (interactive components).
- **Cloudinary**: MediaItem assumes Cloudinary URLs (`publicId`, transformations). Non-Cloudinary sources need adapter.

## Out of Scope

### Explicit Exclusions (Future Enhancements)
- **Pagination**: Current galleries show ≤50 items. Add when portfolios/favorites exceed 100 items.
- **Virtual Scrolling**: CSS Grid masonry sufficient for MVP. Consider `react-window` if performance degrades.
- **URL State Persistence**: Filters/selection stay ephemeral. Add `useSearchParams` integration later if shareable links needed.
- **Drag-Drop Reordering**: Upload order determined by file input. Reordering is separate feature (v2).
- **Batch Upload Progress**: Current `UploadQueue` shows per-item progress. Aggregate progress bar is separate UX improvement.
- **Undo/Redo**: Bulk edits are immediate (Server Action). Add optimistic UI + undo later if user feedback requires it.
- **Advanced Filtering**: MVP supports date range, price range, sort. Tag filters, location filters, AI search are future features.
- **Multi-Gallery Sync**: Each gallery instance has independent state. Cross-gallery selection (e.g., select from multiple spots) is v2.

## Acceptance Criteria

### Core Functionality
- [ ] `useGallerySelection` hook manages selection state without HOC wrapper
- [ ] `useGalleryFilters` hook filters items by date/price/status
- [ ] Gallery renders `toolbar` slot above grid
- [ ] Gallery renders `prepend` slot before items (for AddFileCard)
- [ ] Gallery accepts `renderCard` render prop with item + context
- [ ] BaseCard renders Image/Video with overlays and actions slots
- [ ] BaseCard shows red border when `validation.hasError` is true
- [ ] DraftCard renders DateEditPopover and PriceEditPopover overlays
- [ ] PublicCard renders cart/favorites/share action buttons
- [ ] AddFileCard triggers file input and calls `onFilesSelected` callback

### Toolbar Components
- [ ] SelectionToolbar shows "Select"/"Cancel" button
- [ ] SelectionToolbar displays selected count and renders `renderActions` menu
- [ ] BulkEditToolbar shows date/price popovers when items selected
- [ ] FilterToolbar updates filter state and triggers re-render

### Migration Success
- [ ] GalleryTab.tsx uses new Gallery + SelectionToolbar (withSelect removed)
- [ ] UploadQueue.tsx uses new Gallery + DraftCard + BulkEditToolbar
- [ ] CartPage.tsx uses new Gallery + PublicCard + SelectionToolbar
- [ ] All galleries maintain existing functionality (no regressions)
- [ ] No TypeScript errors in migrated files
- [ ] No console warnings in browser (key props, cleanup, etc.)

### Code Quality
- [ ] No FSD layer violations (checked via grep for forbidden imports)
- [ ] All mutations use Server Actions (no client-side DB calls)
- [ ] Error handling follows centralized pattern (`src/shared/errors/`)
- [ ] No `console.log` statements (except in dev-only debug utils)
- [ ] All components wrapped in `memo` where appropriate
- [ ] Event handlers use `useCallback` to prevent re-render cascades

### Documentation
- [ ] This file documents all architectural decisions
- [ ] Inline JSDoc comments explain hook interfaces
- [ ] Example usage in each toolbar/card component file
- [ ] Migration guide for future galleries (how to compose hooks + slots)

---

## Migration Strategy

**Phase 1: Foundation** (Days 1-2)
- Create hooks (`useGallerySelection`, `useGalleryFilters`)
- Refactor Gallery component to slot-based API
- Build BaseCard with overlay/action slots

**Phase 2: Specialized Cards** (Day 3)
- Create DraftCard, PublicCard, AddFileCard
- Create validation hook (`useUploadValidation`)
- Test cards in isolation (Storybook or standalone route)

**Phase 3: Toolbars** (Day 4)
- Build SelectionToolbar, BulkEditToolbar, FilterToolbar
- Test toolbar interactions with mock selection state

**Phase 4: Migration** (Days 5-6)
- Migrate UploadQueue.tsx (most complex - drafts + validation)
- Migrate GalleryTab.tsx (public gallery with selection)
- Migrate CartPage.tsx (simplest - just remove from cart)
- Delete withSelect.tsx after all migrations pass tests

**Phase 5: Polish** (Day 7)
- Run TypeScript diagnostics across all modified files
- Check for performance issues (React DevTools profiler)
- Update CHANGELOG.md with completed work

---

## Risk Mitigation

### Risk: Breaking Existing Galleries During Migration
**Mitigation**: Keep `withSelect.tsx` until all consumers migrated. Gradual rollout (one gallery per PR).

### Risk: Performance Regression (Re-renders)
**Mitigation**: Benchmark before/after with React DevTools. Use `memo`, `useCallback`, `useMemo` aggressively.

### Risk: Validation Logic Coupling
**Mitigation**: Validation hooks in `features/Upload`, not `widgets/Gallery`. Gallery stays generic.

### Risk: Overly Complex Card Props
**Mitigation**: Keep BaseCard props flat. Use composition (DraftCard, PublicCard) for specialized variants.

---

## Open Questions for Implementation

1. **Hook Return Types**: Should hooks return objects (`{ selectedIds, toggle, ... }`) or tuples (`[state, actions]`)? Objects are more readable, tuples match React conventions.

2. **Card Context**: Does `CardContext` need more data (e.g., `totalItems`, `isEven` for zebra striping)? Start minimal, extend as needed.

3. **Error Boundaries**: Should Gallery wrap cards in ErrorBoundary to prevent one broken card from crashing entire grid? Probably overkill for MVP.

4. **Testing Strategy**: Unit tests for hooks (Jest), integration tests for Gallery (Vitest + Testing Library), or E2E (Playwright)? Prefer integration tests for component behavior.

---

*Document created: February 5, 2026*
*Last updated: February 5, 2026*
