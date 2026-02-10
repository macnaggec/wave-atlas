# Changelog

All notable changes to Wave Atlas are documented here.
This file serves as the **single source of truth** for project status.

---

## [Unreleased] - 2026-02-05

### 🎨 Gallery System Refactoring: Slot-Based Architecture

**Context**: Replaced monolithic `withSelect` HOC with composable slot-based Gallery component following SOLID principles and modern React patterns.

#### Implemented
- [x] **Core Hooks**: Created composable state management hooks
  - `useGallerySelection` - Selection state with O(1) Set-based lookup
  - `useGalleryFilters` - Date/price/status filtering and sorting
  - Replaces HOC state management with reusable hook pattern

- [x] **Slot-Based Gallery Component**: Refactored Gallery.tsx to support composition
  - Props: `toolbar`, `prepend`, `emptyState` slots for UI extension
  - `renderCard` prop receives item + context (index, isFirst, isLast)
  - Generic type support: `<T extends { id: string }>`
  - Removed modal logic (moved to card responsibility)

- [x] **Card Component System**: Built extensible card architecture
  - `BaseCard` - Foundation with overlay/action slots, validation, selection
  - `DraftCard` - Upload tab card with date/price edit popovers
  - `PublicCard` - Gallery card with configurable actions (cart/favorites/share)
  - `AddFileCard` - File input trigger for upload workflows

- [x] **Toolbar Components**: Created reusable toolbar UI
  - `SelectionToolbar` - "Select"/"Cancel" button + bulk action menu
  - `FilterToolbar` - Date range, price range, status filters
  - `BulkEditToolbar` - Bulk date/price editors for upload tab

- [x] **Upload Validation Hook**: Business-specific validation in features layer
  - `useUploadValidation` - Validates drafts before publishing
  - Lives in `features/Upload/hooks/` (domain-specific logic)
  - Returns validation map for red border indicators

#### Architecture Benefits
- ✅ SOLID: Single responsibility (Gallery = layout, cards = content, hooks = state)
- ✅ Composable: Mix and match hooks + slots per use case
- ✅ Extensible: New card types/toolbars without modifying core Gallery
- ✅ Type-safe: Generic types with proper TypeScript inference
- ✅ FSD-compliant: Clear layer boundaries (widgets/features/shared)

#### Migration Status
- 🔄 Ready for migration: All components created, zero TypeScript errors
- 📝 Legacy HOC preserved: `withSelect` available during transition
- 📖 Documentation: [docs/gallery-architecture.md](gallery-architecture.md)

#### Files Created
- `src/shared/hooks/gallery/useGallerySelection.ts`
- `src/shared/hooks/gallery/useGalleryFilters.ts`
- `src/widgets/Gallery/Gallery.tsx` (refactored)
- `src/widgets/Gallery/cards/BaseCard.tsx`
- `src/widgets/Gallery/cards/DraftCard.tsx`
- `src/widgets/Gallery/cards/PublicCard.tsx`
- `src/widgets/Gallery/cards/AddFileCard.tsx`
- `src/widgets/Gallery/toolbars/SelectionToolbar.tsx`
- `src/widgets/Gallery/toolbars/FilterToolbar.tsx`
- `src/widgets/Gallery/toolbars/BulkEditToolbar.tsx`
- `src/features/Upload/hooks/useUploadValidation.ts`
- `docs/gallery-architecture.md` (planning document)

---

## [0.2.0] - 2026-02-04

### 🏗️ Server-First Architecture: SpotDrawer Upload Tab Refactor

**Context**: Improved data fetching strategy following Next.js 15 best practices for App Router

#### Implemented
- [x] **Server-Side Data Fetching**: Moved draft media fetching from client (useEffect) to server (RSC)
  - Draft media fetched in parallel with spot details at route level
  - Auth checked server-side via `auth()` before calling protected actions
  - Eliminates loading spinners and waterfall requests on Upload tab open

- [x] **React Context Pattern**: Introduced `SpotDrawerContext` for clean data flow
  - Provides `spotData` and `draftMedia` to nested components
  - Eliminates props drilling through technical components (SpotDrawerClient)
  - Auth state remains in global SessionProvider (separation of concerns)

- [x] **Shared Server Component**: Created `SpotDrawerWithData` to eliminate duplication
  - Encapsulates all data fetching logic for drawer
  - Used by both intercepted route (`@drawer/(.)spot`) and standalone route (`[spot]`)
  - Reduced 30+ lines of duplicated code per route

- [x] **Component Responsibility Cleanup**:
  - `SpotDrawerClient`: Pure transition logic (animation delay only)
  - `SpotDrawer`: UI layout and tab management (consumes context)
  - `SpotUploadPanel`: Business logic (consumes context directly)
  - `useUploadManager`: Simplified to accept `initialDrafts` from context

- [x] **Performance Optimizations**:
  - Instant tab switching (no data fetch on tab change)
  - Parallel data fetching: `Promise.all([getSpotDetails(), getDraftMedia()])`
  - Proper memory cleanup: blob URL revocation in useUploadManager
  - useCallback/useMemo optimization maintained

#### Architecture Benefits
- ✅ Server-first: Data fetched in RSC, passed via context
- ✅ Zero props drilling: Technical components know nothing about business data
- ✅ DRY: Single source of truth for drawer data fetching
- ✅ Scalable: Context pattern ready for additional consumers (e.g., header badge)
- ✅ Type-safe: Full TypeScript coverage, 0 errors

#### Files Modified
- `app/(main)/@drawer/(.)[spot]/page.tsx` - Simplified to use SpotDrawerWithData
- `app/(main)/[spot]/page.tsx` - Simplified to use SpotDrawerWithData
- `src/widgets/SpotDrawer/SpotDrawerContext.tsx` - New context with spotData + draftMedia
- `src/widgets/SpotDrawer/SpotDrawerWithData.tsx` - New RSC for data fetching
- `src/widgets/SpotDrawer/SpotDrawerClient.tsx` - Removed all props, pure transitions
- `src/widgets/SpotDrawer/SpotDrawer.tsx` - Consumes context instead of props
- `src/features/Upload/SpotUploadPanel.tsx` - Consumes context directly
- `src/features/Upload/useUploadManager.ts` - Removed client-side fetch, uses initialDrafts

#### Quality Audit Results
- ✅ Memory leaks: URL.revokeObjectURL() cleanup verified
- ✅ Performance: useCallback/useMemo/memo patterns maintained
- ✅ FSD architecture: No layer violations
- ✅ TypeScript: 0 errors
- ✅ No console.log statements in modified files
- ✅ Server Actions: Used correctly (no client-side DB calls)

#### Next Steps (Documented in `docs/client-side-refactor-prompt.md`)
- [ ] Review client-side auth pattern in SpotUploadPanel
- [ ] Add error boundaries around drawer components
- [ ] Consider optimistic updates for draft publishing
- [ ] Clean up backward-compatibility flags (isLoadingDrafts)

---

## [0.1.9] - 2026-02-01

### ⚡ Bundle Size Optimization & Performance
- [x] **Icon Tree-Shaking**: Added `@tabler/icons-react` to Next.js `optimizePackageImports` for automatic unused icon elimination
- [x] **Lazy-Loaded Video Player**: HLS.js (~240KB) now loads on-demand when video is rendered:
    - Created `Video/index.tsx` wrapper with dynamic import
    - Added loading placeholder during chunk load
    - Removed `'use client'` from Video component (moved to wrapper)
- [x] **Lazy-Loaded SpotDrawer**: Drawer and Mapbox dependencies load only when needed:
    - Created `SpotDrawerWrapper` client component with dynamic import
    - HomePage remains server component for optimal data fetching
    - Reduces initial JS bundle by ~50-100KB
- [x] **Static Generation with ISR**: Main page uses `revalidate: 86400` (24 hours) instead of `force-dynamic`:
    - Page generated at build time for instant CDN delivery
    - Auto-regenerates daily for fresh spot data
    - Massive performance improvement for globe/map rendering

### 🐛 Build & Type Safety Fixes
- [x] **Import Paths**: Fixed incorrect module imports across codebase:
    - `app/theme` → `./theme` in global-error.tsx
    - `entities/Photo/constants` → `entities/Media/constants`
    - `api/types` → `entities/Media/types`
- [x] **TypeScript Errors**: Resolved implicit `any[]` types in Cart and Uploads pages
- [x] **Server Action Signatures**: Fixed `deleteMedia` calls to use object parameter `{ id }`
- [x] **Event Handlers**: Fixed `toggleAuthType` onClick signature in AuthPage
- [x] **Suspense Boundaries**: Wrapped AuthPage in Suspense for `useSearchParams` compatibility
- [x] **File Extensions**: Renamed `Video/index.ts` → `Video/index.tsx` for JSX syntax support
- [x] **Code Cleanup**: Removed debugging `console.log` statements from Cart components

### 📊 Bundle Analysis Results
```
Route (app)                    Size    First Load JS
┌ ƒ /                         1.36 kB     104 kB  ⬅️ ISR-optimized
├ ○ /_not-found                131 B      103 kB
├ ƒ /[spot]                   1.3 kB      114 kB
└ ○ /auth                      11 kB      151 kB
```

**Expected Impact**: 300-400KB reduction from initial JS bundle through lazy loading

---

## [0.1.6] - 2026-01-31

### 🐛 Bug Fixes
- [x] **Cloudinary Upload Signature**: Fixed "Invalid Signature" error by correcting environment variable naming:
    - Renamed `NEXT_PUBLIC_CLOUDINARY_API_SECRET` → `CLOUDINARY_API_SECRET` (server-only secret)
    - Added runtime validation in `getCloudinarySignature` to fail fast with clear error if Cloudinary credentials are missing
    - Updated `next.config.ts` image `remotePatterns` to match correct cloud name (`dwiz044fs`)
- [x] **Security**: Removed unsafe exposure of API secret through `NEXT_PUBLIC_*` prefix

---

## [0.1.8] - 2026-01-31

### 🏗️ Architecture Refactoring - SOLID Principles
- [x] **Media Actions Refactoring**: Complete SOLID-compliant restructuring of `src/app/actions/media.ts`:
    - **Single Responsibility**: Extracted 6 concerns into dedicated modules (mapper, repository, authorization, Cloudinary, cache, resource type mapping)
    - **Dependency Inversion**: Abstracted Prisma and Cloudinary behind interfaces for testability
    - **Interface Segregation**: Optimized DTOs - reduced `createMediaSchema` from 7 fields to 2 required fields (70% reduction)
    - **Open/Closed**: Extensible `ResourceTypeMapper` for adding new media types without modifying existing code
    - **Code Reduction**: 237 lines → 141 lines (40% reduction), eliminated 65+ lines of duplication

### 📦 New Modules Created
- [x] **MediaMapper** (`src/entities/Media/mapper.ts`): Pure data transformation functions
- [x] **MediaRepository** (`src/shared/api/repositories/MediaRepository.ts`): Database access abstraction layer with `IMediaRepository` interface
- [x] **MediaAuthorizationService** (`src/shared/services/MediaAuthorizationService.ts`): Centralized permission checks
- [x] **CloudinaryService** (`src/shared/services/CloudinaryService.ts`): Cloudinary signature generation and configuration
- [x] **CacheInvalidationService** (`src/shared/services/CacheInvalidationService.ts`): Centralized Next.js cache revalidation strategy
- [x] **ResourceTypeMapper** (`src/shared/services/ResourceTypeMapper.ts`): Configurable media type conversion (Cloudinary → Prisma)

### 🔧 Technical Improvements
- [x] **Testability**: All services injectable/mockable, business logic separated from infrastructure
- [x] **Type Safety**: Updated Zod schemas to v4.3.5 syntax (`z.uuid()`, `z.enum()`)
- [x] **Consistency**: All schemas use object shapes, comprehensive JSDoc comments
- [x] **Maintainability**: Clear separation of concerns, self-documenting interfaces

---

## [0.1.7] - 2026-01-31

### ✨ Upload UX (Spot Drawer)
- [x] **Tabs**: Added URL-driven spot drawer tabs (`tab=gallery|upload`) for a unified Gallery + Upload experience.
- [x] **CTA**: Added “Upload” entry point from spot preview, opening the drawer directly on the Upload tab.
- [x] **Auth-aware Upload Panel**: Signed-out users see a sign-in CTA; signed-in users see the dropzone + upload queue.

### 🐛 Auth & State Fixes
- [x] **Return-to Context**: Sign-in now preserves the initiating URL (keeps `spotId` + `tab=upload`).
- [x] **Session Hydration**: Improved client auth gating to avoid “signed out until refresh” behavior after login.

### 🧹 Error Handling & Stability
- [x] **Client Error Messages**: Centralized unknown-error → message extraction (`shared/lib/getErrorMessage`) and reused across client components.
- [x] **Upload Cleanup**: Fixed object URL cleanup to prevent preview URL leaks on unmount.

---

## [0.1.5] - 2026-01-22

### 🧪 Testing Infrastructure
- [x] **Tech Stack**: Added Vitest + React Testing Library + Playwright foundation.
- [x] **Integration**: configured `vitest.config.ts` with correct alias mapping for FSD structure.
- [x] **Mocks**: Implemented robust Global Mocking Strategy:
    - **Prisma**: Type-safe Singleton Mock (`src/shared/lib/test/prisma.ts`) so tests never touch the real DB.
    - **NextAuth**: Mocked session/auth hooks to bypass complex auth flows in unit tests.
    - **Mantine**: Polyfilled `ResizeObserver` and `matchMedia` for UI component stability.
- [x] **Unit Tests**: Added `src/app/actions/__tests__/spot.test.ts` verifying Server Actions logic independently.
- [x] **Integration Tests**: Added `SpotSearch.test.tsx` verifying full widget Search → Select → Clear flows.

### 🛠 Build & Config
- [x] **Type Safety**: Fixed `vitest.config.ts` module resolution issues.
- [x] **Optimization**: Updated `tsconfig.json` to exclude legacy `server/` folder from the root Next.js build process, resolving 100+ false-positive type errors.
- [x] **Declarations**: Added `vitest.d.ts` to support Jest-DOM matchers (`toBeInTheDocument`) in TypeScript.

---

## [0.1.4] - 2026-01-22

### 🔍 Global Spot Search
- [x] **SpotSearch Widget**: New permanent search bar at top center of main page:
    - Mantine Combobox with async search (debounced 300ms)
    - Minimum 2 characters to trigger search
    - Shows spot name + location in dropdown results
    - Error handling with notifications
- [x] **Keyboard Navigation**:
    - Press Enter to trigger immediate search (bypasses debounce)
    - Arrow keys to navigate results
    - Enter again to select highlighted spot
- [x] **Map Integration**:
    - Selecting spot triggers smooth flyTo animation with top padding
    - Auto-opens SpotPreviewCard popup
    - State-based approach (no URL params) for instant re-selection
- [x] **Smart State Management**:
    - Preview closes when gallery opens (clean UX transition)
    - Closing preview resets state to `null` (enables re-selection of same spot)
    - External spot selection properly clears/sets active popup
- [x] **Code Quality**:
    - Extracted duplicate search logic into `performSearch` helper
    - No TypeScript errors
    - Architecture follows FSD (Widget → Layout → Map communication)

### 📐 Layout Architecture
- [x] **MainLayoutClient**: New client wrapper managing search-to-map communication
- [x] **Prop Drilling**: Clean callback chain (`onSpotSelect`, `onClosePreview`) through GlobeLayout → GlobeMap
- [x] **State Synchronization**: `useEffect` hook syncs URL drawer state with preview visibility

---

## [0.1.3] - 2026-01-21

### 🆕 Spot Drawer (Sidebar)
- [x] **Architecture**: Implemented Server-side data fetching pattern:
    - Root `page.tsx` fetches `getSpotDetails(spotId)`
    - Data passed as props to `<SpotDrawer />` (Client Component)
    - Leveraged Next.js Link prefetching for instant open performance
- [x] **Components**:
    - Created `SpotDrawer` widget using Mantine `Drawer`
    - Integrated reusing `Gallery` widget with selection support
    - Connected `SpotPreviewCard` "View Gallery" button to URL params (`?spotId=...`)
- [x] **Backend**: Added `getSpotDetails` Server Action (fetches all media, photographer info)
- [x] **UX Improvements**:
    - **Smart Positioning**: Map now automatically `flyTo` spots with top-padding (300px) on click, ensuring popups are fully visible and centered.
    - **Config**: Whitelisted Unsplash images in `next.config.ts`

### ☁️ Upload Infrastructure
- [x] **Client Service**: Refactored `uploadToCloudinary` (XHR wrapper) to use standardized typed errors (`BadRequestError`, `BadGatewayError`, etc.) for robust UI feedback.
- [x] **Server Action**: Implemented `getCloudinarySignature` for secure signed uploads.

### 🧙‍♂️ Upload Wizard
- [x] **Frontend**: New `UploadWizard` component with multi-step process (Spot Selection -> Drag & Drop -> Queue)
- [x] **Backend**: Refactored `actions/media.ts` to connect with `MediaItem` schema, added `createMediaItem`
- [x] **State Management**: Created `useUploadManager` hook for tracking signature/upload/save states
- [x] **UI**: Modern `SpotSelect` (Combobox) and `UploadQueue` with progress bars and Mantine integration
- [x] **Security**: Full protection for `/upload` route (redirects to auth if guest)
- [x] **Architecture**: Extracted Cloudinary config to `entities/Media/constants.ts` (SOLID: SRP/DRY)

### 🌍 Globe Map Improvements
- [x] **Interaction**: Fixed "off-center globe" issue by automatically resetting map padding when closing popups or deselecting spots.

## [0.1.2] - 2026-01-19

### 🗄️ Database & Schema
- [x] **Schema Migration**:
    - `Spot.id`: Transitioned from Int to String (UUID)
    - `Photo` → `MediaItem`: Renamed model to support both `PHOTO` and `VIDEO` types (`type` enum)
- [x] **Seeding**: Updated `prisma/seed.ts` to reflect schema changes and seed realistic mixed media

### 🗺️ Map & Preview
- [x] **Spot Preview UI**:
    - Replaced basic Paper popup with `SpotPreviewCard` (Mantine Card)
    - Integrated Image/Video Carousel (Mantine Carousel)
    - Added Safe Server Action (`getSpotPreviewData`) with Zod ID validation (string | number fallback)
- [x] **Bug Fixes**:
    - **Visual**: Fixed Mapbox close button alignment (custom CSS centering)
    - **UI**: Fixed Carousel vertical stacking (imported `@mantine/carousel/styles` globally)
    - **TypeScript**: Fixed Carousel `align` prop type error by moving it to `emblaOptions`

## [0.1.1] - 2026-01-19

### ♻️ Refactoring

#### Globe Map (`src/widgets/GlobeMap/`)
- [x] **Performance**: Switched from DOM Markers to Mapbox GeoJSON Source + Layers (WebGL clustering)
- [x] **Architecture**: Applied SOLID principles (SRP) by extracting logic:
    - `useSpotGeoJson`: Data transformation
    - `useMapInteraction`: Event handling & state
    - `useMapImages`: Image resource loading
    - `layerStyles`: Visual configuration (Layers, Fog)
- [x] **UX**: Added cluster expansion on click and data-driven cursor styles (fixed grab/pointer behavior)
- [x] **UI**: Integrated custom SDF icons (based on `android-chrome-192x192.png`) with dynamic coloring (Blue/Orange/Grey)
- [x] **Cleanup**: Removed unused DOM-based marker styles from `GlobeMap.module.css`

### 🎨 Assets
- [x] Updated App Icons & Favicons in `app/layout.tsx` metadata (32px, 16px, Apple Touch)

## [0.1.0] - 2026-01-17

### 🏗️ Infrastructure

- **Next.js 15 App Router** setup with React 19
- **Feature-Sliced Design** architecture (app → views → widgets → features → entities → shared)
- **PostgreSQL + Prisma** ORM with models: User, Photo, Spot, Purchase, Transaction
- **NextAuth.js v5** authentication with JWT sessions, PrismaAdapter
- **Mantine UI v8** theming and components
- **Error handling system** with HttpError classes, Prisma/Auth error mappers, global error boundaries
- **Fastify backend server** (separate `/server/`) with Inversify IoC, MongoDB, Cloudinary integration

### ✅ Implemented Features

#### Authentication (`src/views/AuthPage/`)
- [x] Email/password login & registration
- [x] Form validation with Zod v4
- [x] Session management (JWT)
- [x] Protected routes via middleware
- [x] `useUser()` hook for client-side session

#### Globe Map (`src/widgets/GlobeMap/`)
- [x] Interactive 3D globe with Mapbox GL
- [x] Spot markers on map
- [x] **New**: Spot status visualization (Verified vs. Community)
- [x] **Optimized**: Map markers performance (memoization)
- [x] Globe-first landing page layout

#### Gallery (`src/widgets/Gallery/`)
- [x] Media gallery with grid layout
- [x] Photo/video support
- [x] Selection mode for cart

#### Spots (`src/entities/Spot/`, `src/app/actions/spots.ts`)
- [x] Spot data model with coordinates
- [x] **Update**: Added `status` (verified/unverified) and `creatorId` fields
- [x] **Fix**: Validated coordinates in `getSpots` (prevents "Null Island")
- [x] `getSpots()` server action with search filter
- [x] Spot search widget (`src/widgets/SpotSearch/`)

#### Upload UI (`src/features/Upload/`)
- [x] Upload page shell
- [x] Spot selection component
- [x] Upload preview component
- [x] File upload hook (`useFileUpload`)

#### Layout & Navigation
- [x] App layout with Header/Footer
- [x] Auth layout (standalone)
- [x] Welcome widget
- [x] 404 Not Found page

### 🔄 In Progress / Partial

#### Cart (`src/features/Cart/`)
- [x] CartPage and CartMenu UI shells
- [ ] Cart state management (currently empty array)
- [ ] Add/remove items functionality
- [ ] Price calculation

#### Spot Page (`app/(main)/[spot]/page.tsx`)
- [x] Route exists
- [ ] Media fetching (commented out)
- [ ] Full spot detail display

#### Media Management (`src/app/actions/media.ts`)
- [x] `getUserMedia()` action (protected)
- [x] `uploadMedia()` action (protected)
- [ ] Watermarking integration
- [ ] Delete functionality

---

## 🎯 Current Focus

- **Active**: Wiring up Spot Page (`[spot]/page.tsx`) with real data (`getSpots`)
- Cart functionality completion
- Purchase flow foundation

---

## 📋 Backlog

### Core MVP
- [ ] Complete cart state management (add/remove/persist)
- [ ] Implement purchase flow (checkout → payment → download)
- [ ] Stripe integration for payments
- [ ] Watermark system for preview vs purchased media
- [ ] Download links generation for purchased items

### Media & Upload
- [ ] Connect upload UI to server upload endpoint
- [ ] Cloudinary upload with watermark generation
- [ ] Media pricing (photographer sets price)
- [ ] Publish/unpublish media toggle

### User Features
- [ ] User profile page (photographer/surfer view)
- [ ] User balance display
- [ ] Transaction history UI
- [ ] Payout request system

### Search & Discovery
- [ ] Date filtering for media search
- [ ] Advanced spot filtering
- [ ] Media preview modal

### Platform
- [ ] Google/Facebook OAuth integration
- [ ] Platform fee calculation (on purchase)
- [ ] Admin dashboard (future)

---

## 📝 Notes

- **Dual architecture**: Next.js handles main app, Fastify server (`/server/`) exists for potential API-first or microservice approach
- **Database**: PostgreSQL (Prisma) for Next.js app, MongoDB (Mongoose) configured in Fastify server
- **Requirements reference**: See `/server/requirements.md` for original Russian specification

---

## Legend

- ✅ / [x] = Completed
- 🔄 = In Progress
- 📋 = Planned/Backlog
- ❌ = Blocked/Removed
