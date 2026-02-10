# SpotDrawer Upload Tab: Client-Side Review

## Completed: Server-First Data Flow

**Architecture established:**
- Data fetching: `SpotDrawerWithData` (RSC) → fetches spot details + draft media in parallel
- Data transport: `SpotDrawerContext` provides `{ spotData, draftMedia }` to nested components
- Auth: Server checks via `auth()` before fetching drafts; client uses global `SessionProvider`
- Zero props drilling: Technical components (SpotDrawerClient) know nothing about data

**Key files:**
- `src/widgets/SpotDrawer/SpotDrawerWithData.tsx` - RSC that fetches data
- `src/widgets/SpotDrawer/SpotDrawerContext.tsx` - Context provider
- `src/features/Upload/SpotUploadPanel.tsx` - Consumes context + SessionProvider
- `src/features/Upload/useUploadManager.ts` - Initializes queue from `initialDrafts`

---

## Review: Current Client Implementation

### 1. Auth Pattern in SpotUploadPanel
```tsx
const { isAuthenticated, isLoading } = useUser(); // ← Shows loading spinner
const { draftMedia } = useSpotDrawerContext();    // ← Server already decided

if (isLoading) return <Loader />; // ← Redundant?
if (!isAuthenticated) return <SignInCTA />;
```

**Question**: Server already checked auth. Can we eliminate client loading state?

### 2. Upload Queue Initialization
```tsx
useEffect(() => {
  if (!initialDrafts || hasInitialized.current) return;
  setQueue(initialDrafts.map(...));
  hasInitialized.current = true;
}, [initialDrafts]);
```

**Question**: Is useEffect + ref pattern optimal? Alternative approaches?

### 3. Tab State Management
- Tab lives in URL: `?tab=upload`
- `isTabActive` prop passed to SpotUploadPanel
- `useUploadManager` receives it but doesn't use it anymore

**Question**: Can we remove `isTabActive`? Does upload panel need to know tab state?

### 4. Cleanup & Memory Leaks
```tsx
useEffect(() => {
  return () => {
    queueRef.current.forEach(item => {
      if (item.previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(item.previewUrl);
      }
    });
  };
}, []); // Runs on unmount
```

**Question**: Is cleanup comprehensive? Any missing patterns?

---

## Discussion Topics

1. **Auth UX**: If `draftMedia === null`, is that sufficient to show sign-in CTA? Or keep separate session check?
2. **Error Handling**: Where to add error boundaries? What fallback UI?
3. **Loading States**: Can we remove `isLoadingDrafts: false` backward-compatibility flag?
4. **Optimistic Updates**: When draft is published, should it update context immediately?

---

## Start Discussion

"Let's review the auth pattern in SpotUploadPanel. The server already decided whether to fetch drafts based on authentication. Do we still need the client-side loading state from useUser(), or can we rely on draftMedia presence from context?"

