# Upload Attempt Lifecycle — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current client-owned cleanup model with a server-authoritative `UploadAttempt` record that owns the upload lifecycle from intent through finalization or cancellation, resolving all orphaned-asset and race-condition bugs.

**Architecture:** Server creates and owns an `UploadAttempt` row before any provider work starts. State transitions are conditional (compare-and-set). The browser store holds only transient resources (File, blob URL, progress). A thin `uploadCoordinator` orchestrates the browser side; `useUploadManager` preserves the existing public UI API throughout migration.

**Tech Stack:** PostgreSQL / Prisma, tRPC, Zod, Zustand, TanStack Query, Cloudinary, Google Drive Picker, Vitest (integration + server + client suites).

**Spec:** `docs/superpowers/specs/2026-06-23-upload-source-protocol-design.md`

---

## File map

### New files

| File | Responsibility |
|---|---|
| `src/shared/types/upload.ts` | Upload enums, status constants, shared projections, DirectUploadGrant |
| `src/shared/validation/uploadSchemas.ts` | Zod schemas for all upload routes |
| `src/server/ports/UploadAssetStorage.ts` | `DirectUploadPort`, `RemoteImportPort`, `AssetCleanupPort` interfaces |
| `src/server/repositories/UploadAttemptRepository.ts` | Attempt persistence + atomic use-case operations |
| `src/server/repositories/UploadAttemptRepository.integration.test.ts` | PostgreSQL integration tests |
| `src/server/services/UploadService.ts` | Begin / finalize / cancel / discard / processDrive policy |
| `src/server/services/UploadService.test.ts` | Service unit tests with mocked ports + repository |
| `src/server/routes/uploads.ts` | `uploadsRouter` — all upload lifecycle commands |
| `src/server/jobs/reconcileUploadAttempts.ts` | Scheduled reconciler |
| `src/features/Upload/model/uploadCoordinator.ts` | Pure browser orchestration (no tRPC / Query imports) |
| `src/features/Upload/model/useUploadCommands.ts` | tRPC mutations + Query invalidation for uploads |

### Modified files

| File | Change summary |
|---|---|
| `prisma/schema.prisma` | Add `UploadSource` enum, `UploadAttemptStatus` enum, `UploadAttempt` model; add `uploadAttemptId` to `MediaItem` |
| `src/server/router.ts` | Register `uploadsRouter` |
| `src/server/services/CloudinaryService.ts` | Implement `DirectUploadPort`, `RemoteImportPort`, `AssetCleanupPort` |
| `src/server/repositories/SurfSessionRepository.ts` | Add `hasBlockingAttempts(sessionId)` used by publish policy |
| `src/server/services/SurfSessionService.ts` | Enforce publish policy via `hasBlockingAttempts` |
| `src/features/Upload/model/types.ts` | Replace `UploadItem`/`GalleryCard` with `BrowserTransfer` / `AttemptCard` / `DraftCard` |
| `src/features/Upload/model/uploadStore.ts` | Replace queue with transfer store keyed by `clientRequestId` |
| `src/features/Upload/model/useUploadManager.ts` | Compose coordinator + commands; preserve public API |
| `src/features/Upload/model/useUploadQueue.ts` | Merge attempt projection + media projection + transfers |
| `src/features/Upload/model/useGooglePicker.ts` | Delegate to manager; own only OAuth + Picker UI |
| `src/features/Upload/model/useClearUploadQueue.ts` | Release browser resources only (no server calls) |
| `src/features/Upload/ui/UploadGallery/StepModeModal.tsx` | Await `discardAll`; stay open on DB failure |

---

## Stage 1 — Persisted contract

### Task 1 — Shared upload types and validation schemas

**Context: fresh**

**Files:**
- Create: `src/shared/types/upload.ts`
- Create: `src/shared/validation/uploadSchemas.ts`

- [ ] **Step 1: Create shared types**

```ts
// src/shared/types/upload.ts
export const UPLOAD_SOURCE = { LOCAL: 'LOCAL', DRIVE: 'DRIVE' } as const;

export const UPLOAD_ATTEMPT_STATUS = {
  READY: 'READY',
  ACQUIRING: 'ACQUIRING',
  FINALIZING: 'FINALIZING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCEL_REQUESTED: 'CANCEL_REQUESTED',
  CLEANUP_PENDING: 'CLEANUP_PENDING',
  CANCELLED: 'CANCELLED',
} as const;

export type UploadSource = typeof UPLOAD_SOURCE[keyof typeof UPLOAD_SOURCE];
export type UploadAttemptStatus = typeof UPLOAD_ATTEMPT_STATUS[keyof typeof UPLOAD_ATTEMPT_STATUS];

/** Statuses that prevent a draft from publishing. */
export const STATUSES_BLOCKING_PUBLISH = [
  UPLOAD_ATTEMPT_STATUS.READY,
  UPLOAD_ATTEMPT_STATUS.ACQUIRING,
  UPLOAD_ATTEMPT_STATUS.FINALIZING,
  UPLOAD_ATTEMPT_STATUS.FAILED,
] as const satisfies readonly UploadAttemptStatus[];

/** Statuses where the attempt may still produce a Cloudinary asset needing cleanup. */
export const STATUSES_NEEDING_RECONCILIATION = [
  UPLOAD_ATTEMPT_STATUS.READY,
  UPLOAD_ATTEMPT_STATUS.FAILED,
  UPLOAD_ATTEMPT_STATUS.CANCEL_REQUESTED,
  UPLOAD_ATTEMPT_STATUS.CLEANUP_PENDING,
] as const satisfies readonly UploadAttemptStatus[];

/** Safe attempt shape returned to the client. Never includes OAuth tokens. */
export interface UploadAttemptProjection {
  id: string;
  clientRequestId: string;
  source: UploadSource;
  status: UploadAttemptStatus;
  cloudinaryPublicId: string;
  errorCode: string | null;
  createdAt: Date;
}

/** Grant returned by beginLocal — all fields needed by the browser XHR. */
export interface DirectUploadGrant {
  attemptId: string;
  cloudinaryPublicId: string;
  signature: string;
  timestamp: number;
  cloudName: string;
  apiKey: string;
  type: 'authenticated';
  eager: string;
  expiresAt: Date;
}
```

- [ ] **Step 2: Create validation schemas**

```ts
// src/shared/validation/uploadSchemas.ts
import { z } from 'zod';

export const beginLocalSchema = z.object({
  draftId: z.string().uuid(),
  clientRequestId: z.string().uuid(),
  declaredMimeType: z.string().min(1).max(100),
  declaredByteSize: z.number().int().positive(),
});

export const finalizeLocalSchema = z.object({
  attemptId: z.string().uuid(),
  providerReceipt: z.unknown(),
  capturedAt: z.coerce.date().optional(),
});

export const beginDriveSchema = z.object({
  draftId: z.string().uuid(),
  clientRequestId: z.string().uuid(),
  remoteFileId: z.string().min(1),
  declaredMimeType: z.string().min(1).max(100),
});

export const processDriveSchema = z.object({
  attemptId: z.string().uuid(),
  accessToken: z.string().min(1),
});

export const discardAttemptSchema = z.object({
  attemptId: z.string().uuid(),
});

export const discardDraftSchema = z.object({
  draftId: z.string().uuid(),
});

export const listAttemptsForDraftSchema = z.object({
  draftId: z.string().uuid(),
});
```

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/shared/types/upload.ts src/shared/validation/uploadSchemas.ts
git commit -m "feat(upload): shared attempt types and route validation schemas"
```

---

### Task 2 — Prisma schema additions

**Context: sequential**

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add enums and model to schema**

Add after the existing `enum MediaType` block in `prisma/schema.prisma`:

```prisma
enum UploadSource {
  LOCAL
  DRIVE
}

enum UploadAttemptStatus {
  READY
  ACQUIRING
  FINALIZING
  COMPLETED
  FAILED
  CANCEL_REQUESTED
  CLEANUP_PENDING
  CANCELLED
}

model UploadAttempt {
  id                   String              @id @default(uuid())
  clientRequestId      String              @map("client_request_id")
  sessionId            String              @map("session_id")
  photographerId       String              @map("photographer_id")
  source               UploadSource
  status               UploadAttemptStatus @default(READY)
  cloudinaryPublicId   String              @unique @map("cloudinary_public_id")
  expectedMediaType    MediaType           @map("expected_media_type")
  remoteFileId         String?             @map("remote_file_id")
  lastErrorCode        String?             @map("last_error_code")
  uploadGrantExpiresAt DateTime?           @map("upload_grant_expires_at")
  expiresAt            DateTime            @map("expires_at")
  createdAt            DateTime            @default(now()) @map("created_at")
  updatedAt            DateTime            @updatedAt @map("updated_at")

  session   SurfSession @relation(
    fields:     [sessionId, photographerId],
    references: [id, photographerId]
  )
  mediaItem MediaItem?

  @@unique([photographerId, clientRequestId], map: "upload_attempts_photographer_client_request_key")
  @@index([sessionId, status], map: "upload_attempts_session_status_idx")
  @@index([status, expiresAt], map: "upload_attempts_status_expires_idx")
  @@map("upload_attempts")
}
```

Add to the `SurfSession` model (below `mediaItems MediaItem[]`):

```prisma
  uploadAttempts UploadAttempt[]
```

Add to the `MediaItem` model (below `purchases Purchase[]`):

```prisma
  uploadAttemptId String?        @unique @map("upload_attempt_id")
  uploadAttempt   UploadAttempt? @relation(fields: [uploadAttemptId], references: [id])
```

- [ ] **Step 2: Validate schema**

```bash
npx prisma validate
```

Expected: `The schema at prisma/schema.prisma is valid`.

- [ ] **Step 3: Commit schema only (migration comes next task)**

```bash
git add prisma/schema.prisma
git commit -m "feat(upload): add UploadAttempt model and enums to Prisma schema"
```

---

### Task 3 — Migration and backfill

**Context: sequential**

**Files:**
- New migration file under `prisma/migrations/`

- [ ] **Step 1: Preflight check for duplicate Cloudinary IDs**

Run this SQL against the dev database before creating the migration:

```sql
SELECT cloudinary_public_id, COUNT(*) as cnt
FROM media_items
WHERE deleted_at IS NULL
GROUP BY cloudinary_public_id
HAVING COUNT(*) > 1;
```

Expected: zero rows. If any exist, investigate and deduplicate before continuing.

- [ ] **Step 2: Generate migration**

```bash
npx prisma migrate dev --name add_upload_attempts
```

This generates `prisma/migrations/<timestamp>_add_upload_attempts/migration.sql`.

- [ ] **Step 3: Edit the generated migration to add backfill SQL**

Open the generated `migration.sql` and append after the `CREATE TABLE` and `ADD COLUMN` statements:

```sql
-- Backfill: one COMPLETED attempt per existing non-deleted media row.
INSERT INTO upload_attempts (
  id, client_request_id, session_id, photographer_id,
  source, status, cloudinary_public_id, expected_media_type,
  remote_file_id, expires_at, created_at, updated_at
)
SELECT
  gen_random_uuid(),
  gen_random_uuid(),
  mi.session_id,
  mi.photographer_id,
  CASE WHEN mi.import_source = 'DRIVE' THEN 'DRIVE' ELSE 'LOCAL' END::upload_source,
  'COMPLETED'::upload_attempt_status,
  mi.cloudinary_public_id,
  CASE WHEN mi.type = 'VIDEO' THEN 'VIDEO' ELSE 'PHOTO' END::media_type,
  mi.remote_file_id,
  NOW() + INTERVAL '1 year',
  mi.created_at,
  NOW()
FROM media_items mi
WHERE mi.deleted_at IS NULL;

-- Link each media row to its backfilled attempt.
UPDATE media_items mi
SET upload_attempt_id = ua.id
FROM upload_attempts ua
WHERE ua.cloudinary_public_id = mi.cloudinary_public_id;

-- Make upload_attempt_id required now that every row is linked.
ALTER TABLE media_items ALTER COLUMN upload_attempt_id SET NOT NULL;
```

- [ ] **Step 4: Apply migration to dev database**

```bash
npx prisma migrate deploy
npx prisma generate
```

Expected: migration applies cleanly; `prisma generate` regenerates the client.

- [ ] **Step 5: Verify backfill**

```bash
npx prisma studio
```

Or run:

```sql
SELECT COUNT(*) FROM upload_attempts WHERE status = 'COMPLETED';
-- Should equal: SELECT COUNT(*) FROM media_items WHERE deleted_at IS NULL;

SELECT COUNT(*) FROM media_items WHERE upload_attempt_id IS NULL;
-- Should be zero.
```

- [ ] **Step 6: Commit**

```bash
git add prisma/migrations/ prisma/schema.prisma
git commit -m "feat(upload): migration — create upload_attempts, backfill COMPLETED rows"
```

---

### Task 4 — UploadAttemptRepository

**Context: sequential**

**Files:**
- Create: `src/server/repositories/UploadAttemptRepository.ts`

- [ ] **Step 1: Write the failing integration test first**

Create `src/server/repositories/UploadAttemptRepository.integration.test.ts`:

```ts
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from 'server/db';
import { randomUUID } from 'node:crypto';
import { UploadAttemptRepository } from './UploadAttemptRepository';

const repo = new UploadAttemptRepository();

async function clearTestData() {
  await prisma.mediaItem.deleteMany();
  await prisma.uploadAttempt.deleteMany();
  await prisma.surfSession.deleteMany();
  await prisma.user.deleteMany();
}

async function seedPhotographerAndDraft() {
  const user = await prisma.user.create({ data: { email: `test-${randomUUID()}@example.com` } });
  const session = await prisma.surfSession.create({
    data: { photographerId: user.id, status: 'DRAFT' },
  });
  return { photographerId: user.id, sessionId: session.id };
}

beforeEach(clearTestData);
afterAll(async () => { await clearTestData(); await prisma.$disconnect(); });

describe('beginLocalIdempotent', () => {
  it('returns the same attempt on a duplicate clientRequestId', async () => {
    const { photographerId, sessionId } = await seedPhotographerAndDraft();
    const input = {
      clientRequestId: randomUUID(),
      sessionId,
      photographerId,
      cloudinaryPublicId: `wave-atlas/users/${photographerId}/test-${randomUUID()}`,
      expectedMediaType: 'PHOTO' as const,
      uploadGrantExpiresAt: new Date(Date.now() + 60_000),
      expiresAt: new Date(Date.now() + 3_600_000),
    };

    const first = await repo.beginLocalIdempotent(input);
    const second = await repo.beginLocalIdempotent(input);

    expect(second.id).toBe(first.id);
    expect(await prisma.uploadAttempt.count({ where: { photographerId } })).toBe(1);
  });
});

describe('finalizeIntoDraft', () => {
  it('creates one MediaItem and marks attempt COMPLETED atomically', async () => {
    const { photographerId, sessionId } = await seedPhotographerAndDraft();
    const attempt = await prisma.uploadAttempt.create({
      data: {
        clientRequestId: randomUUID(),
        sessionId,
        photographerId,
        source: 'LOCAL',
        status: 'READY',
        cloudinaryPublicId: `test/${randomUUID()}`,
        expectedMediaType: 'PHOTO',
        expiresAt: new Date(Date.now() + 3_600_000),
      },
    });

    const media = await repo.finalizeIntoDraft(attempt.id, photographerId, {
      capturedAt: new Date('2026-01-15T08:00:00Z'),
      thumbnailUrl: 'https://res.cloudinary.com/demo/image/upload/t_thumb/test.jpg',
      lightboxUrl: 'https://res.cloudinary.com/demo/image/upload/test.jpg',
      resourceType: 'PHOTO' as const,
    });

    expect(media.uploadAttemptId).toBe(attempt.id);
    const updated = await prisma.uploadAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
    expect(updated.status).toBe('COMPLETED');
  });

  it('throws and creates no MediaItem when attempt is CANCEL_REQUESTED', async () => {
    const { photographerId, sessionId } = await seedPhotographerAndDraft();
    const attempt = await prisma.uploadAttempt.create({
      data: {
        clientRequestId: randomUUID(),
        sessionId,
        photographerId,
        source: 'LOCAL',
        status: 'CANCEL_REQUESTED',
        cloudinaryPublicId: `test/${randomUUID()}`,
        expectedMediaType: 'PHOTO',
        expiresAt: new Date(Date.now() + 3_600_000),
      },
    });

    await expect(
      repo.finalizeIntoDraft(attempt.id, photographerId, {
        capturedAt: new Date(),
        thumbnailUrl: 'https://example.com/thumb.jpg',
        lightboxUrl: 'https://example.com/full.jpg',
        resourceType: 'PHOTO' as const,
      }),
    ).rejects.toThrow();

    expect(await prisma.mediaItem.count({ where: { sessionId } })).toBe(0);
  });
});

describe('cancelAttempt', () => {
  it('transitions READY → CANCEL_REQUESTED', async () => {
    const { photographerId, sessionId } = await seedPhotographerAndDraft();
    const attempt = await prisma.uploadAttempt.create({
      data: {
        clientRequestId: randomUUID(), sessionId, photographerId,
        source: 'LOCAL', status: 'READY',
        cloudinaryPublicId: `test/${randomUUID()}`,
        expectedMediaType: 'PHOTO',
        expiresAt: new Date(Date.now() + 3_600_000),
      },
    });

    await repo.cancelAttempt(attempt.id, photographerId);
    const updated = await prisma.uploadAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
    expect(updated.status).toBe('CANCEL_REQUESTED');
  });

  it('is idempotent when already CANCEL_REQUESTED', async () => {
    const { photographerId, sessionId } = await seedPhotographerAndDraft();
    const attempt = await prisma.uploadAttempt.create({
      data: {
        clientRequestId: randomUUID(), sessionId, photographerId,
        source: 'LOCAL', status: 'CANCEL_REQUESTED',
        cloudinaryPublicId: `test/${randomUUID()}`,
        expectedMediaType: 'PHOTO',
        expiresAt: new Date(Date.now() + 3_600_000),
      },
    });

    await expect(repo.cancelAttempt(attempt.id, photographerId)).resolves.not.toThrow();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm run test:db:up
npx vitest run --project integration src/server/repositories/UploadAttemptRepository.integration.test.ts
```

Expected: `UploadAttemptRepository` import fails — file does not exist yet.

- [ ] **Step 3: Implement the repository**

```ts
// src/server/repositories/UploadAttemptRepository.ts
import { MediaType, Prisma, UploadAttemptStatus } from '@prisma/client';
import { prisma } from 'server/db';
import { runQuery } from 'server/lib/PrismaErrorMapper';
import { BadRequestError, ForbiddenError, NotFoundError } from 'shared/errors';
import type { UploadAttemptProjection } from 'shared/types/upload';

export type BeginLocalInput = {
  clientRequestId: string;
  sessionId: string;
  photographerId: string;
  cloudinaryPublicId: string;
  expectedMediaType: MediaType;
  uploadGrantExpiresAt: Date;
  expiresAt: Date;
};

export type FinalizeMediaInput = {
  capturedAt: Date;
  thumbnailUrl: string;
  lightboxUrl: string;
  resourceType: MediaType;
};

const CANCELLABLE_STATUSES: UploadAttemptStatus[] = [
  'READY', 'ACQUIRING', 'FINALIZING', 'FAILED',
];

export interface IUploadAttemptRepository {
  beginLocalIdempotent(input: BeginLocalInput): Promise<UploadAttemptProjection>;
  beginDriveIdempotent(input: BeginLocalInput & { remoteFileId: string }): Promise<UploadAttemptProjection>;
  markAcquiring(attemptId: string, photographerId: string): Promise<void>;
  finalizeIntoDraft(attemptId: string, photographerId: string, media: FinalizeMediaInput): Promise<{ id: string; uploadAttemptId: string }>;
  cancelAttempt(attemptId: string, photographerId: string): Promise<void>;
  findByIdForPhotographer(attemptId: string, photographerId: string): Promise<UploadAttemptProjection | null>;
  listForDraft(sessionId: string, photographerId: string): Promise<UploadAttemptProjection[]>;
  hasBlockingAttempts(sessionId: string): Promise<boolean>;
}

function toProjection(row: {
  id: string; clientRequestId: string; source: string; status: string;
  cloudinaryPublicId: string; lastErrorCode: string | null; createdAt: Date;
}): UploadAttemptProjection {
  return {
    id: row.id,
    clientRequestId: row.clientRequestId,
    source: row.source as UploadAttemptProjection['source'],
    status: row.status as UploadAttemptProjection['status'],
    cloudinaryPublicId: row.cloudinaryPublicId,
    errorCode: row.lastErrorCode,
    createdAt: row.createdAt,
  };
}

export class UploadAttemptRepository implements IUploadAttemptRepository {
  beginLocalIdempotent(input: BeginLocalInput): Promise<UploadAttemptProjection> {
    return runQuery(async () => {
      const existing = await prisma.uploadAttempt.findUnique({
        where: { photographerId_clientRequestId: { photographerId: input.photographerId, clientRequestId: input.clientRequestId } },
      });
      if (existing) return toProjection(existing);
      return toProjection(await prisma.uploadAttempt.create({
        data: {
          clientRequestId: input.clientRequestId,
          sessionId: input.sessionId,
          photographerId: input.photographerId,
          source: 'LOCAL',
          cloudinaryPublicId: input.cloudinaryPublicId,
          expectedMediaType: input.expectedMediaType,
          uploadGrantExpiresAt: input.uploadGrantExpiresAt,
          expiresAt: input.expiresAt,
        },
      }));
    });
  }

  beginDriveIdempotent(input: BeginLocalInput & { remoteFileId: string }): Promise<UploadAttemptProjection> {
    return runQuery(async () => {
      const existing = await prisma.uploadAttempt.findUnique({
        where: { photographerId_clientRequestId: { photographerId: input.photographerId, clientRequestId: input.clientRequestId } },
      });
      if (existing) return toProjection(existing);
      return toProjection(await prisma.uploadAttempt.create({
        data: {
          clientRequestId: input.clientRequestId,
          sessionId: input.sessionId,
          photographerId: input.photographerId,
          source: 'DRIVE',
          cloudinaryPublicId: input.cloudinaryPublicId,
          expectedMediaType: input.expectedMediaType,
          remoteFileId: input.remoteFileId,
          expiresAt: input.expiresAt,
        },
      }));
    });
  }

  markAcquiring(attemptId: string, photographerId: string): Promise<void> {
    return runQuery(async () => {
      const result = await prisma.uploadAttempt.updateMany({
        where: { id: attemptId, photographerId, status: 'READY' },
        data: { status: 'ACQUIRING' },
      });
      if (result.count === 0) {
        const attempt = await prisma.uploadAttempt.findUnique({ where: { id: attemptId } });
        if (!attempt || attempt.photographerId !== photographerId) throw new NotFoundError('UploadAttempt');
        // Already transitioned — idempotent; only fail on wrong state
        if (attempt.status !== 'ACQUIRING') throw new BadRequestError('Attempt cannot be acquired in its current state');
      }
    });
  }

  finalizeIntoDraft(attemptId: string, photographerId: string, media: FinalizeMediaInput): Promise<{ id: string; uploadAttemptId: string }> {
    return runQuery(async () => {
      const attempt = await prisma.uploadAttempt.findUnique({ where: { id: attemptId } });
      if (!attempt || attempt.photographerId !== photographerId) throw new NotFoundError('UploadAttempt');
      if (!(['READY', 'ACQUIRING', 'FINALIZING'] as UploadAttemptStatus[]).includes(attempt.status)) {
        throw new BadRequestError('Attempt is not eligible for finalization');
      }

      return prisma.$transaction(async (tx) => {
        // Claim the attempt (guard against concurrent finalization)
        const claimed = await tx.uploadAttempt.updateMany({
          where: { id: attemptId, photographerId, status: { in: ['READY', 'ACQUIRING', 'FINALIZING'] } },
          data: { status: 'FINALIZING' },
        });
        if (claimed.count === 0) throw new BadRequestError('Attempt was cancelled or already finalized');

        const mediaRow = await tx.mediaItem.create({
          data: {
            sessionId: attempt.sessionId,
            photographerId: attempt.photographerId,
            cloudinaryPublicId: attempt.cloudinaryPublicId,
            type: media.resourceType,
            thumbnailUrl: media.thumbnailUrl,
            lightboxUrl: media.lightboxUrl,
            capturedAt: media.capturedAt,
            importSource: attempt.source === 'DRIVE' ? 'DRIVE' : 'DIRECT',
            remoteFileId: attempt.remoteFileId ?? undefined,
            uploadAttemptId: attemptId,
          },
        });

        await tx.uploadAttempt.update({ where: { id: attemptId }, data: { status: 'COMPLETED' } });
        return { id: mediaRow.id, uploadAttemptId: attemptId };
      });
    });
  }

  cancelAttempt(attemptId: string, photographerId: string): Promise<void> {
    return runQuery(async () => {
      const result = await prisma.uploadAttempt.updateMany({
        where: { id: attemptId, photographerId, status: { in: CANCELLABLE_STATUSES } },
        data: { status: 'CANCEL_REQUESTED' },
      });
      if (result.count === 0) {
        const attempt = await prisma.uploadAttempt.findUnique({ where: { id: attemptId } });
        if (!attempt || attempt.photographerId !== photographerId) throw new NotFoundError('UploadAttempt');
        // Already in CANCEL_REQUESTED, CLEANUP_PENDING, or CANCELLED — idempotent
      }
    });
  }

  findByIdForPhotographer(attemptId: string, photographerId: string): Promise<UploadAttemptProjection | null> {
    return runQuery(async () => {
      const row = await prisma.uploadAttempt.findUnique({ where: { id: attemptId } });
      if (!row || row.photographerId !== photographerId) return null;
      return toProjection(row);
    });
  }

  listForDraft(sessionId: string, photographerId: string): Promise<UploadAttemptProjection[]> {
    return runQuery(async () => {
      const rows = await prisma.uploadAttempt.findMany({
        where: {
          sessionId,
          photographerId,
          status: { notIn: ['COMPLETED', 'CANCELLED'] },
        },
        orderBy: { createdAt: 'asc' },
      });
      return rows.map(toProjection);
    });
  }

  hasBlockingAttempts(sessionId: string): Promise<boolean> {
    return runQuery(async () => {
      const count = await prisma.uploadAttempt.count({
        where: {
          sessionId,
          status: { in: ['READY', 'ACQUIRING', 'FINALIZING', 'FAILED'] },
        },
      });
      return count > 0;
    });
  }
}

export const uploadAttemptRepository = new UploadAttemptRepository();
```

- [ ] **Step 4: Run integration tests**

```bash
npx vitest run --project integration src/server/repositories/UploadAttemptRepository.integration.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/server/repositories/UploadAttemptRepository.ts \
        src/server/repositories/UploadAttemptRepository.integration.test.ts
git commit -m "feat(upload): UploadAttemptRepository with idempotent begin, atomic finalize, cancel"
```

---

## Stage 2 — Server application boundary

### Task 5 — UploadAssetStorage ports and CloudinaryService implementations

**Context: fresh**

**Files:**
- Create: `src/server/ports/UploadAssetStorage.ts`
- Modify: `src/server/services/CloudinaryService.ts`

- [ ] **Step 1: Define the three port interfaces**

```ts
// src/server/ports/UploadAssetStorage.ts
import type { MediaType } from '@prisma/client';
import type { DirectUploadGrant } from 'shared/types/upload';

export interface UploadTarget {
  cloudinaryPublicId: string;
  expectedMediaType: MediaType;
  photographerId: string;
}

export interface StoredAsset {
  cloudinaryPublicId: string;
  resourceType: MediaType;
  thumbnailUrl: string;
  lightboxUrl: string;
}

export interface StoredAssetIdentity {
  cloudinaryPublicId: string;
  resourceType: MediaType;
}

export interface RemoteImportInput {
  sourceUrl: string;
  authHeaders: Record<string, string>;
  target: UploadTarget;
}

export interface DirectUploadPort {
  createUploadGrant(target: UploadTarget, expiresAt: Date): DirectUploadGrant;
  verifyUploadReceipt(receipt: unknown, target: UploadTarget): Promise<StoredAsset>;
}

export interface RemoteImportPort {
  importRemoteFile(input: RemoteImportInput): Promise<StoredAsset>;
}

export interface AssetCleanupPort {
  deleteAsset(asset: StoredAssetIdentity): Promise<void>;
}
```

- [ ] **Step 2: Implement ports on CloudinaryService**

Add to `CloudinaryService.ts` after the existing class definition:

```ts
import type { DirectUploadPort, RemoteImportPort, AssetCleanupPort, UploadTarget, StoredAsset, StoredAssetIdentity, RemoteImportInput } from 'server/ports/UploadAssetStorage';
import type { DirectUploadGrant } from 'shared/types/upload';
```

Add to the `CloudinaryService` class:

```ts
  // ── DirectUploadPort ────────────────────────────────────────────────────────

  createUploadGrant(target: UploadTarget, expiresAt: Date): DirectUploadGrant {
    const timestamp = Math.round(Date.now() / 1000);
    const folder = `wave-atlas/users/${target.photographerId}`;
    const publicId = target.cloudinaryPublicId;
    const eager = MEDIA_CLOUDINARY_TRANSFORMS.join('|');
    const type = 'authenticated' as const;

    const paramsToSign = { timestamp, public_id: publicId, folder, eager, type };
    const signature = cloudinary.utils.api_sign_request(paramsToSign, process.env.CLOUDINARY_API_SECRET!);

    return {
      attemptId: '',           // filled in by UploadService
      cloudinaryPublicId: publicId,
      signature,
      timestamp,
      cloudName: MEDIA_UPLOAD_CONFIG.cloudName,
      apiKey: MEDIA_UPLOAD_CONFIG.apiKey,
      type,
      eager,
      expiresAt,
    };
  }

  async verifyUploadReceipt(receipt: unknown, target: UploadTarget): Promise<StoredAsset> {
    // Validate the untrusted Cloudinary webhook/upload response at the trust boundary.
    const parsed = cloudinaryReceiptSchema.safeParse(receipt);
    if (!parsed.success) throw new BadRequestError('Invalid Cloudinary upload receipt');
    const data = parsed.data;
    if (data.public_id !== target.cloudinaryPublicId) {
      throw new BadRequestError('Upload receipt does not match the intended target');
    }
    const resourceType = toMediaResourceType(data.resource_type);
    return {
      cloudinaryPublicId: data.public_id,
      resourceType: resourceType === 'image' ? 'PHOTO' : 'VIDEO',
      thumbnailUrl: libGenerateDeliveryUrl(data.public_id, 'thumbnail'),
      lightboxUrl: libGenerateDeliveryUrl(data.public_id, 'lightbox'),
    };
  }

  // ── RemoteImportPort ────────────────────────────────────────────────────────

  async importRemoteFile(input: RemoteImportInput): Promise<StoredAsset> {
    const result = await this.uploadFromUrl(
      input.sourceUrl,
      input.authHeaders,
      `wave-atlas/users/${input.target.photographerId}`,
    );
    return {
      cloudinaryPublicId: result.publicId,
      resourceType: result.resourceType === 'video' ? 'VIDEO' : 'PHOTO',
      thumbnailUrl: result.thumbnailUrl,
      lightboxUrl: result.lightboxUrl,
    };
  }

  // ── AssetCleanupPort ────────────────────────────────────────────────────────

  async deleteAsset(asset: StoredAssetIdentity): Promise<void> {
    await this.deleteAsset(
      asset.cloudinaryPublicId,
      asset.resourceType === 'VIDEO' ? 'video' : 'image',
    );
  }
```

Add the Zod receipt schema near the top of `CloudinaryService.ts`:

```ts
import { z } from 'zod';

const cloudinaryReceiptSchema = z.object({
  public_id: z.string().min(1),
  resource_type: z.string(),
  bytes: z.number().optional(),
  format: z.string().optional(),
});
```

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/server/ports/UploadAssetStorage.ts src/server/services/CloudinaryService.ts
git commit -m "feat(upload): UploadAssetStorage port interfaces + CloudinaryService implementations"
```

---

### Task 6 — UploadService: beginLocal, finalizeLocal, beginDrive, processDrive

**Context: sequential**

**Files:**
- Create: `src/server/services/UploadService.ts`
- Create: `src/server/services/UploadService.test.ts`

- [ ] **Step 1: Write failing unit tests**

```ts
// src/server/services/UploadService.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UploadService } from './UploadService';
import type { IUploadAttemptRepository } from 'server/repositories/UploadAttemptRepository';
import type { DirectUploadPort, RemoteImportPort, AssetCleanupPort } from 'server/ports/UploadAssetStorage';
import type { ISurfSessionRepository } from 'server/repositories/SurfSessionRepository';
import { randomUUID } from 'node:crypto';

const mockRepo: IUploadAttemptRepository = {
  beginLocalIdempotent: vi.fn(),
  beginDriveIdempotent: vi.fn(),
  markAcquiring: vi.fn(),
  finalizeIntoDraft: vi.fn(),
  cancelAttempt: vi.fn(),
  findByIdForPhotographer: vi.fn(),
  listForDraft: vi.fn(),
  hasBlockingAttempts: vi.fn(),
};

const mockDirect: DirectUploadPort = {
  createUploadGrant: vi.fn(),
  verifyUploadReceipt: vi.fn(),
};

const mockImport: RemoteImportPort = {
  importRemoteFile: vi.fn(),
};

const mockCleanup: AssetCleanupPort = {
  deleteAsset: vi.fn(),
};

const mockSessions: Pick<ISurfSessionRepository, 'findDraftById'> = {
  findDraftById: vi.fn(),
};

const service = new UploadService(mockRepo, mockDirect, mockImport, mockCleanup, mockSessions);

const photographerId = randomUUID();
const sessionId = randomUUID();
const attemptId = randomUUID();

beforeEach(() => vi.clearAllMocks());

describe('beginLocal', () => {
  it('verifies draft ownership before creating an attempt', async () => {
    vi.mocked(mockSessions.findDraftById).mockResolvedValue({
      id: sessionId, photographerId: 'other-user',
    } as never);

    await expect(
      service.beginLocal(photographerId, { draftId: sessionId, clientRequestId: randomUUID(), declaredMimeType: 'image/jpeg', declaredByteSize: 1024 }),
    ).rejects.toThrow('permission');
  });

  it('returns a DirectUploadGrant with the attemptId filled in', async () => {
    const draft = { id: sessionId, photographerId } as never;
    const attempt = { id: attemptId, cloudinaryPublicId: 'test/abc', clientRequestId: 'r1', source: 'LOCAL', status: 'READY', errorCode: null, createdAt: new Date() } as never;
    const grant = { attemptId: '', cloudinaryPublicId: 'test/abc', signature: 'sig', timestamp: 1, cloudName: 'c', apiKey: 'k', type: 'authenticated', eager: 'e', expiresAt: new Date() } as never;

    vi.mocked(mockSessions.findDraftById).mockResolvedValue(draft);
    vi.mocked(mockRepo.beginLocalIdempotent).mockResolvedValue(attempt);
    vi.mocked(mockDirect.createUploadGrant).mockReturnValue(grant);

    const result = await service.beginLocal(photographerId, {
      draftId: sessionId, clientRequestId: 'r1', declaredMimeType: 'image/jpeg', declaredByteSize: 1024,
    });

    expect(result.attemptId).toBe(attemptId);
  });
});

describe('processDrive', () => {
  it('deletes the late asset and does not finalize when attempt is CANCEL_REQUESTED', async () => {
    const attempt = { id: attemptId, photographerId, cloudinaryPublicId: 'test/abc', status: 'CANCEL_REQUESTED', source: 'DRIVE', errorCode: null, createdAt: new Date(), clientRequestId: 'r1' } as never;
    vi.mocked(mockRepo.markAcquiring).mockResolvedValue();
    vi.mocked(mockImport.importRemoteFile).mockResolvedValue({ cloudinaryPublicId: 'test/abc', resourceType: 'PHOTO', thumbnailUrl: 't', lightboxUrl: 'l' });
    vi.mocked(mockRepo.findByIdForPhotographer).mockResolvedValue(attempt);

    await service.processDrive(photographerId, { attemptId, accessToken: 'token' });

    expect(mockCleanup.deleteAsset).toHaveBeenCalledWith({ cloudinaryPublicId: 'test/abc', resourceType: 'PHOTO' });
    expect(mockRepo.finalizeIntoDraft).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to confirm failure**

```bash
npx vitest run --project server src/server/services/UploadService.test.ts
```

Expected: module not found.

- [ ] **Step 3: Implement UploadService**

```ts
// src/server/services/UploadService.ts
import { randomUUID } from 'node:crypto';
import { MediaType } from '@prisma/client';
import { ForbiddenError, NotFoundError } from 'shared/errors';
import type { IUploadAttemptRepository } from 'server/repositories/UploadAttemptRepository';
import type { DirectUploadPort, RemoteImportPort, AssetCleanupPort } from 'server/ports/UploadAssetStorage';
import type { ISurfSessionRepository } from 'server/repositories/SurfSessionRepository';
import type { DirectUploadGrant, UploadAttemptProjection } from 'shared/types/upload';

const GRANT_TTL_MS  = 60 * 60 * 1000;   // 1 hour
const ATTEMPT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function mimeToMediaType(mime: string): MediaType {
  return mime.startsWith('video/') ? 'VIDEO' : 'PHOTO';
}

export class UploadService {
  constructor(
    private repo: IUploadAttemptRepository,
    private direct: DirectUploadPort,
    private remote: RemoteImportPort,
    private cleanup: AssetCleanupPort,
    private sessions: Pick<ISurfSessionRepository, 'findDraftById'>,
  ) {}

  async beginLocal(
    photographerId: string,
    input: { draftId: string; clientRequestId: string; declaredMimeType: string; declaredByteSize: number },
  ): Promise<DirectUploadGrant> {
    const draft = await this.sessions.findDraftById(input.draftId);
    if (!draft) throw new NotFoundError('Surf Session');
    if (draft.photographerId !== photographerId) throw new ForbiddenError('You do not have permission to upload to this session');

    const expectedMediaType = mimeToMediaType(input.declaredMimeType);
    const cloudinaryPublicId = `wave-atlas/users/${photographerId}/${randomUUID()}`;
    const uploadGrantExpiresAt = new Date(Date.now() + GRANT_TTL_MS);
    const expiresAt = new Date(Date.now() + ATTEMPT_TTL_MS);

    const attempt = await this.repo.beginLocalIdempotent({
      clientRequestId: input.clientRequestId,
      sessionId: input.draftId,
      photographerId,
      cloudinaryPublicId,
      expectedMediaType,
      uploadGrantExpiresAt,
      expiresAt,
    });

    const grant = this.direct.createUploadGrant(
      { cloudinaryPublicId: attempt.cloudinaryPublicId, expectedMediaType, photographerId },
      uploadGrantExpiresAt,
    );
    return { ...grant, attemptId: attempt.id };
  }

  async finalizeLocal(
    photographerId: string,
    input: { attemptId: string; providerReceipt: unknown; capturedAt?: Date },
  ): Promise<{ mediaId: string }> {
    const attempt = await this.repo.findByIdForPhotographer(input.attemptId, photographerId);
    if (!attempt) throw new NotFoundError('UploadAttempt');

    const asset = await this.direct.verifyUploadReceipt(input.providerReceipt, {
      cloudinaryPublicId: attempt.cloudinaryPublicId,
      expectedMediaType: attempt.source === 'DRIVE' ? 'PHOTO' : 'PHOTO',
      photographerId,
    });

    const media = await this.repo.finalizeIntoDraft(input.attemptId, photographerId, {
      capturedAt: input.capturedAt ?? new Date(),
      thumbnailUrl: asset.thumbnailUrl,
      lightboxUrl: asset.lightboxUrl,
      resourceType: asset.resourceType,
    });

    return { mediaId: media.id };
  }

  async beginDrive(
    photographerId: string,
    input: { draftId: string; clientRequestId: string; remoteFileId: string; declaredMimeType: string },
  ): Promise<{ attemptId: string }> {
    const draft = await this.sessions.findDraftById(input.draftId);
    if (!draft) throw new NotFoundError('Surf Session');
    if (draft.photographerId !== photographerId) throw new ForbiddenError('You do not have permission to upload to this session');

    const expectedMediaType = mimeToMediaType(input.declaredMimeType);
    const cloudinaryPublicId = `wave-atlas/users/${photographerId}/${randomUUID()}`;

    const attempt = await this.repo.beginDriveIdempotent({
      clientRequestId: input.clientRequestId,
      sessionId: input.draftId,
      photographerId,
      cloudinaryPublicId,
      expectedMediaType,
      remoteFileId: input.remoteFileId,
      uploadGrantExpiresAt: new Date(Date.now() + GRANT_TTL_MS),
      expiresAt: new Date(Date.now() + ATTEMPT_TTL_MS),
    });

    return { attemptId: attempt.id };
  }

  async processDrive(
    photographerId: string,
    input: { attemptId: string; accessToken: string },
  ): Promise<void> {
    await this.repo.markAcquiring(input.attemptId, photographerId);

    const attempt = await this.repo.findByIdForPhotographer(input.attemptId, photographerId);
    if (!attempt || !attempt.cloudinaryPublicId) throw new NotFoundError('UploadAttempt');

    let asset;
    try {
      asset = await this.remote.importRemoteFile({
        sourceUrl: `https://www.googleapis.com/drive/v3/files/${(attempt as any).remoteFileId}?alt=media`,
        authHeaders: { Authorization: `Bearer ${input.accessToken}` },
        target: { cloudinaryPublicId: attempt.cloudinaryPublicId, expectedMediaType: 'PHOTO', photographerId },
      });
    } catch (err) {
      await this.repo.cancelAttempt(input.attemptId, photographerId);
      throw err;
    }

    // Re-read to check for cancellation that arrived during import.
    const current = await this.repo.findByIdForPhotographer(input.attemptId, photographerId);
    if (current?.status === 'CANCEL_REQUESTED') {
      await this.cleanup.deleteAsset({ cloudinaryPublicId: asset.cloudinaryPublicId, resourceType: asset.resourceType });
      return;
    }

    await this.repo.finalizeIntoDraft(input.attemptId, photographerId, {
      capturedAt: new Date(),
      thumbnailUrl: asset.thumbnailUrl,
      lightboxUrl: asset.lightboxUrl,
      resourceType: asset.resourceType,
    });
  }

  listForDraft(photographerId: string, sessionId: string): Promise<UploadAttemptProjection[]> {
    return this.repo.listForDraft(sessionId, photographerId);
  }
}

import { uploadAttemptRepository } from 'server/repositories/UploadAttemptRepository';
import { cloudinaryService } from './CloudinaryService';
import { surfSessionRepository } from 'server/repositories/SurfSessionRepository';

export const uploadService = new UploadService(
  uploadAttemptRepository,
  cloudinaryService,
  cloudinaryService,
  cloudinaryService,
  surfSessionRepository,
);
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run --project server src/server/services/UploadService.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/server/services/UploadService.ts src/server/services/UploadService.test.ts
git commit -m "feat(upload): UploadService begin/finalize/processDrive with ownership checks"
```

---

### Task 7 — uploadsRouter and router registration

**Context: sequential**

**Files:**
- Create: `src/server/routes/uploads.ts`
- Modify: `src/server/router.ts`

- [ ] **Step 1: Create uploads router**

```ts
// src/server/routes/uploads.ts
import { router, protectedProcedure } from 'server/trpc';
import { uploadService } from 'server/services/UploadService';
import { createRateLimiter } from 'server/lib/rateLimiter';
import {
  beginLocalSchema,
  finalizeLocalSchema,
  beginDriveSchema,
  processDriveSchema,
  discardAttemptSchema,
  discardDraftSchema,
  listAttemptsForDraftSchema,
} from 'shared/validation/uploadSchemas';

const beginLimiter = createRateLimiter({ windowMs: 60_000, max: 30 });

export const uploadsRouter = router({
  beginLocal: protectedProcedure
    .input(beginLocalSchema)
    .mutation(({ input, ctx }) => {
      beginLimiter(ctx.user!.id);
      return uploadService.beginLocal(ctx.user!.id, input);
    }),

  finalizeLocal: protectedProcedure
    .input(finalizeLocalSchema)
    .mutation(({ input, ctx }) =>
      uploadService.finalizeLocal(ctx.user!.id, input),
    ),

  beginDrive: protectedProcedure
    .input(beginDriveSchema)
    .mutation(({ input, ctx }) => {
      beginLimiter(ctx.user!.id);
      return uploadService.beginDrive(ctx.user!.id, input);
    }),

  processDrive: protectedProcedure
    .input(processDriveSchema)
    .mutation(({ input, ctx }) =>
      uploadService.processDrive(ctx.user!.id, input),
    ),

  discard: protectedProcedure
    .input(discardAttemptSchema)
    .mutation(({ input, ctx }) =>
      uploadService.discardAttempt(ctx.user!.id, input.attemptId),
    ),

  discardDraft: protectedProcedure
    .input(discardDraftSchema)
    .mutation(({ input, ctx }) =>
      uploadService.discardDraft(ctx.user!.id, input.draftId),
    ),

  listForDraft: protectedProcedure
    .input(listAttemptsForDraftSchema)
    .query(({ input, ctx }) =>
      uploadService.listForDraft(ctx.user!.id, input.draftId),
    ),
});
```

- [ ] **Step 2: Register in appRouter**

```ts
// src/server/router.ts
import { router } from 'server/trpc';
import { spotsRouter } from './routes/spots';
import { mediaRouter } from './routes/media';
import { usersRouter } from './routes/users';
import { checkoutRouter } from './routes/checkout';
import { sessionsRouter } from './routes/sessions';
import { uploadsRouter } from './routes/uploads';

export const appRouter = router({
  spots: spotsRouter,
  media: mediaRouter,
  users: usersRouter,
  checkout: checkoutRouter,
  sessions: sessionsRouter,
  uploads: uploadsRouter,
});

export type AppRouter = typeof appRouter;
```

- [ ] **Step 3: Typecheck and build**

```bash
npx tsc --noEmit
npm run build
```

Expected: no errors, build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/server/routes/uploads.ts src/server/router.ts
git commit -m "feat(upload): uploadsRouter — beginLocal, finalizeLocal, beginDrive, processDrive, listForDraft"
```

---

## Stage 3 — Client ownership split

### Task 8 — BrowserTransfer union and upload store

**Context: fresh**

**Files:**
- Modify: `src/features/Upload/model/types.ts`
- Modify: `src/features/Upload/model/uploadStore.ts`

- [ ] **Step 1: Replace UploadItem with BrowserTransfer in types.ts**

The existing `UploadItem`, `UploadStatus`, `GalleryCard` types are replaced. Keep `MediaItem` import and `isVideoItem` / `getMediaId` helpers — update them to operate on the new union.

```ts
// src/features/Upload/model/types.ts
import type { MediaItem } from 'entities/Media';
import type { UploadAttemptStatus, UploadSource } from 'shared/types/upload';

// ── Browser-only transfer resources ────────────────────────────────────────
// The store owns these. They are lost on page reload.

export type LocalTransfer = {
  source: 'local';
  clientRequestId: string;
  attemptId?: string;         // undefined until beginLocal resolves
  file: File;
  previewUrl: string;
  progress: number;
  abort?: () => void;
};

export type DriveTransfer = {
  source: 'drive';
  clientRequestId: string;
  attemptId?: string;         // undefined until beginDrive resolves
  previewUrl: string;
};

export type BrowserTransfer = LocalTransfer | DriveTransfer;

// ── Gallery cards ────────────────────────────────────────────────────────────

/**
 * 'pending': beginLocal / beginDrive has not yet returned.
 * UploadAttemptStatus thereafter, from the Query projection.
 */
export type AttemptCardStatus = 'pending' | UploadAttemptStatus;

export type AttemptCard = {
  kind: 'attempt';
  /** clientRequestId before server responds; attemptId after. */
  id: string;
  source: UploadSource;
  status: AttemptCardStatus;
  previewUrl: string;
  progress?: number;       // local only
  errorCode?: string;      // set when status is FAILED
};

export type DraftCard = {
  kind: 'draft';
  id: string;
  result: MediaItem;
};

export type GalleryCard = AttemptCard | DraftCard;

export function getItemId(card: GalleryCard): string {
  return card.id;
}

export function isVideoItem(card: GalleryCard): boolean {
  if (card.kind === 'draft') return card.result.resource.resourceType === 'video';
  return false; // resource type known only after finalization
}

export function revokeBlobUrl(url?: string): void {
  if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
}
```

- [ ] **Step 2: Replace uploadStore**

```ts
// src/features/Upload/model/uploadStore.ts
import { create } from 'zustand';
import type { BrowserTransfer } from './types';

interface TransferState {
  transfers: Map<string, BrowserTransfer>;   // keyed by clientRequestId
}

interface TransferActions {
  addTransfer: (t: BrowserTransfer) => void;
  updateTransfer: (clientRequestId: string, updates: Partial<BrowserTransfer>) => void;
  removeTransfer: (clientRequestId: string) => void;
  clearTransfers: () => void;
  getAll: () => BrowserTransfer[];
}

export const useUploadStore = create<TransferState & TransferActions>()((set, get) => ({
  transfers: new Map(),

  addTransfer: (t) =>
    set(s => { const m = new Map(s.transfers); m.set(t.clientRequestId, t); return { transfers: m }; }),

  updateTransfer: (id, updates) =>
    set(s => {
      const existing = s.transfers.get(id);
      if (!existing) return s;
      const m = new Map(s.transfers);
      m.set(id, { ...existing, ...updates } as BrowserTransfer);
      return { transfers: m };
    }),

  removeTransfer: (id) =>
    set(s => { const m = new Map(s.transfers); m.delete(id); return { transfers: m }; }),

  clearTransfers: () => set({ transfers: new Map() }),

  getAll: () => Array.from(get().transfers.values()),
}));
```

- [ ] **Step 3: Fix TypeScript errors from removed types**

```bash
npx tsc --noEmit 2>&1 | head -40
```

Make a note of all files that still reference `UploadItem`, `UploadStatus`, `uploadQueue`, `addToQueue`, `clearQueue`. These will be fixed in subsequent tasks (Tasks 9–13). For now, add `// @ts-ignore` only to keep CI green if needed — or proceed directly to the next tasks in the same session.

- [ ] **Step 4: Commit**

```bash
git add src/features/Upload/model/types.ts src/features/Upload/model/uploadStore.ts
git commit -m "feat(upload): replace UploadItem/uploadStore with BrowserTransfer discriminated union"
```

---

### Task 9 — useUploadCommands

**Context: sequential**

**Files:**
- Create: `src/features/Upload/model/useUploadCommands.ts`

- [ ] **Step 1: Create the hook**

```ts
// src/features/Upload/model/useUploadCommands.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTRPC } from 'shared/lib/trpc';

/**
 * All tRPC mutations and Query wiring for the upload lifecycle.
 * The coordinator receives these as plain async functions — no tRPC imports needed there.
 */
export function useUploadCommands(draftId: string) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: trpc.sessions.draftMedia.queryKey(draftId) });

  const invalidateAttempts = () =>
    queryClient.invalidateQueries({ queryKey: trpc.uploads.listForDraft.queryKey({ draftId }) });

  const beginLocal = useMutation(trpc.uploads.beginLocal.mutationOptions()).mutateAsync;
  const finalizeLocal = useMutation(trpc.uploads.finalizeLocal.mutationOptions({
    onSuccess: () => { void invalidate(); void invalidateAttempts(); },
  })).mutateAsync;
  const beginDrive = useMutation(trpc.uploads.beginDrive.mutationOptions()).mutateAsync;
  const processDrive = useMutation(trpc.uploads.processDrive.mutationOptions({
    onSuccess: () => { void invalidate(); void invalidateAttempts(); },
  })).mutateAsync;
  const discard = useMutation(trpc.uploads.discard.mutationOptions({
    onSuccess: () => { void invalidateAttempts(); },
  })).mutateAsync;
  const discardDraft = useMutation(trpc.uploads.discardDraft.mutationOptions({
    onSuccess: () => { void invalidate(); void invalidateAttempts(); },
  })).mutateAsync;

  const attempts = useQuery(trpc.uploads.listForDraft.queryOptions({ draftId }));

  return {
    beginLocal,
    finalizeLocal,
    beginDrive,
    processDrive,
    discard,
    discardDraft,
    attempts: attempts.data ?? [],
    invalidateDraftMedia: invalidate,
  };
}

export type UploadCommands = ReturnType<typeof useUploadCommands>;
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/features/Upload/model/useUploadCommands.ts
git commit -m "feat(upload): useUploadCommands — tRPC mutations + Query wiring for attempt lifecycle"
```

---

### Task 10 — uploadCoordinator

**Context: fresh**

**Files:**
- Create: `src/features/Upload/model/uploadCoordinator.ts`

- [ ] **Step 1: Write the coordinator**

```ts
// src/features/Upload/model/uploadCoordinator.ts
import { v4 as uuidv4 } from 'uuid';
import { uploadToCloudinary } from './cloudinaryTransport';
import { useUploadStore } from './uploadStore';
import { revokeBlobUrl } from './types';
import type { UploadCommands } from './useUploadCommands';
import type { BrowserTransfer, DriveTransfer } from './types';

// ── Deps injected from useUploadManager ──────────────────────────────────────

export type CoordinatorDeps = {
  commands: UploadCommands;
  draftId: string;
};

// ── Local upload ─────────────────────────────────────────────────────────────

export async function startLocalUpload(file: File, deps: CoordinatorDeps): Promise<void> {
  const clientRequestId = uuidv4();
  const previewUrl = URL.createObjectURL(file);

  useUploadStore.getState().addTransfer({
    source: 'local',
    clientRequestId,
    file,
    previewUrl,
    progress: 0,
  });

  try {
    const grant = await deps.commands.beginLocal({
      draftId: deps.draftId,
      clientRequestId,
      declaredMimeType: file.type,
      declaredByteSize: file.size,
    });

    useUploadStore.getState().updateTransfer(clientRequestId, { attemptId: grant.attemptId });

    const { promise, abort } = uploadToCloudinary({
      file,
      signature: grant.signature,
      timestamp: grant.timestamp,
      apiKey: grant.apiKey,
      cloudName: grant.cloudName,
      folder: '',           // public_id is already scoped — folder param not needed
      eager: grant.eager,
      onProgress: (progress) =>
        useUploadStore.getState().updateTransfer(clientRequestId, { progress }),
    });

    useUploadStore.getState().updateTransfer(clientRequestId, { abort });

    const receipt = await promise;

    await deps.commands.finalizeLocal({
      attemptId: grant.attemptId,
      providerReceipt: receipt,
    });

    // Remove browser resources — MediaItem is now in Query cache.
    revokeBlobUrl(previewUrl);
    useUploadStore.getState().removeTransfer(clientRequestId);
  } catch (err) {
    const transfer = useUploadStore.getState().transfers.get(clientRequestId);
    if (!transfer) return; // already removed (discard during upload)
    // Leave transfer in store with current state — attempt status comes from Query.
    useUploadStore.getState().updateTransfer(clientRequestId, { progress: 0 });
    throw err;
  }
}

// ── Drive upload ─────────────────────────────────────────────────────────────

export type DriveSelection = {
  remoteFileId: string;
  declaredMimeType: string;
  thumbnailUrl: string;
  accessToken: string;
};

export async function startDriveUpload(
  selection: DriveSelection,
  deps: CoordinatorDeps,
): Promise<void> {
  const clientRequestId = uuidv4();

  useUploadStore.getState().addTransfer({
    source: 'drive',
    clientRequestId,
    previewUrl: selection.thumbnailUrl,
  });

  const { attemptId } = await deps.commands.beginDrive({
    draftId: deps.draftId,
    clientRequestId,
    remoteFileId: selection.remoteFileId,
    declaredMimeType: selection.declaredMimeType,
  });

  useUploadStore.getState().updateTransfer(clientRequestId, { attemptId });

  await deps.commands.processDrive({ attemptId, accessToken: selection.accessToken });

  // Remove browser thumbnail — MediaItem is now in Query cache.
  useUploadStore.getState().removeTransfer(clientRequestId);
}

// ── Discard ───────────────────────────────────────────────────────────────────

export async function discardAttempt(
  clientRequestIdOrAttemptId: string,
  deps: CoordinatorDeps,
): Promise<void> {
  // Find the transfer by clientRequestId or attemptId.
  const all = useUploadStore.getState().getAll();
  const transfer = all.find(
    t => t.clientRequestId === clientRequestIdOrAttemptId
      || t.attemptId === clientRequestIdOrAttemptId,
  );

  // Abort in-flight XHR immediately.
  if (transfer?.source === 'local' && transfer.abort) {
    try { transfer.abort(); } catch { /* expected */ }
  }

  if (transfer?.source === 'local') revokeBlobUrl(transfer.previewUrl);

  if (transfer?.attemptId) {
    await deps.commands.discard({ attemptId: transfer.attemptId });
  }

  if (transfer) {
    useUploadStore.getState().removeTransfer(transfer.clientRequestId);
  }
}

export async function discardAllDraft(deps: CoordinatorDeps): Promise<void> {
  // Abort all in-flight local XHRs immediately.
  useUploadStore.getState().getAll().forEach(t => {
    if (t.source === 'local') {
      if (t.abort) try { t.abort(); } catch { /* expected */ }
      revokeBlobUrl(t.previewUrl);
    }
  });

  // Single server transaction — awaited before UI clears.
  await deps.commands.discardDraft({ draftId: deps.draftId });

  useUploadStore.getState().clearTransfers();
}

// ── Retry ─────────────────────────────────────────────────────────────────────

export async function retryAttempt(
  clientRequestIdOrAttemptId: string,
  deps: CoordinatorDeps,
  requestDriveAccessToken: () => Promise<string>,
): Promise<void> {
  const transfer = useUploadStore.getState().getAll().find(
    t => t.clientRequestId === clientRequestIdOrAttemptId
      || t.attemptId === clientRequestIdOrAttemptId,
  );

  if (!transfer) return;

  if (transfer.source === 'local') {
    await startLocalUpload(transfer.file, deps);
    useUploadStore.getState().removeTransfer(transfer.clientRequestId);
  } else {
    // Drive retry: obtain fresh access token, then re-process.
    const accessToken = await requestDriveAccessToken();
    if (!transfer.attemptId) return;
    await deps.commands.processDrive({ attemptId: transfer.attemptId, accessToken });
    useUploadStore.getState().removeTransfer(transfer.clientRequestId);
  }
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/features/Upload/model/uploadCoordinator.ts
git commit -m "feat(upload): uploadCoordinator — pure orchestration, no tRPC/Query imports"
```

---

### Task 11 — useGooglePicker simplified

**Context: sequential**

**Files:**
- Modify: `src/features/Upload/model/useGooglePicker.ts`

- [ ] **Step 1: Rewrite the picker hook**

The hook now owns only OAuth token request, picker UI, and document-to-selection translation. It delegates to a callback provided by the manager.

```ts
// src/features/Upload/model/useGooglePicker.ts
import { useCallback, useState } from 'react';
import { notify } from 'shared/lib/notifications';
import type { DriveSelection } from './uploadCoordinator';

const DRIVE_READONLY_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';
const PICKER_MIME_TYPES = [
  'image/jpeg','image/png','image/gif','image/webp',
  'image/tiff','image/heic','image/heif',
  'video/mp4','video/quicktime','video/x-msvideo','video/webm','video/mpeg',
].join(',');

type DriveDoc = google.picker.PickerDocument;

export async function requestDriveAccessToken(): Promise<string> {
  if (!window.google?.accounts?.oauth2) {
    throw new Error('Google Sign-in is not available yet. Please try again.');
  }
  return new Promise((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      scope: DRIVE_READONLY_SCOPE,
      callback: (r) => r.error || !r.access_token
        ? reject(new Error('Google Drive access was denied.'))
        : resolve(r.access_token),
      error_callback: () => reject(new Error('Google Drive authorization failed.')),
    });
    client.requestAccessToken({ prompt: '' });
  });
}

async function loadGooglePicker(): Promise<void> {
  if (!window.gapi) throw new Error('Google Picker is not loaded yet.');
  await Promise.race([
    new Promise<void>(resolve => gapi.load('picker', resolve)),
    new Promise<never>((_, r) => setTimeout(() => r(new Error('Picker timed out.')), 10_000)),
  ]);
}

export function useGooglePicker(
  onSelection: (selections: DriveSelection[], accessToken: string) => Promise<void>,
) {
  const [isLoading, setIsLoading] = useState(false);

  const trigger = useCallback(async () => {
    setIsLoading(true);
    try {
      const accessToken = await requestDriveAccessToken();
      await loadGooglePicker();

      await new Promise<void>((resolve, reject) => {
        const picker = new google.picker.PickerBuilder()
          .addView(
            new google.picker.DocsView(google.picker.ViewId.DOCS)
              .setMimeTypes(PICKER_MIME_TYPES)
              .setIncludeFolders(false),
          )
          .setOAuthToken(accessToken)
          .setDeveloperKey(import.meta.env.VITE_GOOGLE_API_KEY ?? '')
          .enableFeature(google.picker.Feature.MULTISELECT_ENABLED)
          .setTitle('Select photos or videos from Google Drive')
          .setCallback(async (data: google.picker.PickerResponseObject) => {
            if (data.action === google.picker.Action.CANCEL) { resolve(); return; }
            if (data.action === google.picker.Action.PICKED) {
              const selections: DriveSelection[] = (data.docs ?? []).map(doc => ({
                remoteFileId: doc.id,
                declaredMimeType: doc.mimeType,
                thumbnailUrl: doc.thumbnails?.[0]?.url ?? doc.url ?? '',
                accessToken,
              }));
              try { await onSelection(selections, accessToken); resolve(); }
              catch (err) { reject(err); }
            }
          })
          .build();
        picker.setVisible(true);
      });
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Google Drive import failed.', 'Drive Error');
    } finally {
      setIsLoading(false);
    }
  }, [onSelection]);

  return { trigger, isPickerLoading: isLoading };
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/features/Upload/model/useGooglePicker.ts
git commit -m "feat(upload): useGooglePicker — owns OAuth+picker UI only, delegates to onSelection callback"
```

---

### Task 12 — useUploadQueue with AttemptCard merge

**Context: sequential**

**Files:**
- Modify: `src/features/Upload/model/useUploadQueue.ts`

- [ ] **Step 1: Rewrite useUploadQueue**

```ts
// src/features/Upload/model/useUploadQueue.ts
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTRPC } from 'shared/lib/trpc';
import { useUploadStore } from './uploadStore';
import type { AttemptCard, DraftCard, GalleryCard } from './types';
import type { UploadAttemptProjection } from 'shared/types/upload';

export function useUploadQueue(draftId: string) {
  const trpc = useTRPC();
  const { data: attempts = [] } = useQuery(trpc.uploads.listForDraft.queryOptions({ draftId }));
  const { data: draftMedia = [] } = useQuery(trpc.sessions.draftMedia.queryOptions(draftId));
  const transfers = useUploadStore(s => s.getAll());

  const queue = useMemo<GalleryCard[]>(() => {
    const cards: GalleryCard[] = [];
    const attemptIdsSeen = new Set<string>();

    // Attempt cards: merge server attempt projection with browser transfer.
    for (const attempt of attempts as UploadAttemptProjection[]) {
      attemptIdsSeen.add(attempt.id);
      const transfer = transfers.find(t => t.attemptId === attempt.id);
      const card: AttemptCard = {
        kind: 'attempt',
        id: attempt.id,
        source: attempt.source,
        status: attempt.status,
        previewUrl: transfer?.previewUrl ?? '',
        progress: transfer?.source === 'local' ? transfer.progress : undefined,
        errorCode: attempt.errorCode ?? undefined,
      };
      cards.push(card);
    }

    // Browser-only transfers that have no server attempt yet (pending window).
    for (const t of transfers) {
      if (t.attemptId && attemptIdsSeen.has(t.attemptId)) continue;
      const card: AttemptCard = {
        kind: 'attempt',
        id: t.clientRequestId,
        source: t.source.toUpperCase() as AttemptCard['source'],
        status: 'pending',
        previewUrl: t.previewUrl,
        progress: t.source === 'local' ? t.progress : undefined,
      };
      cards.push(card);
    }

    // Draft cards: completed media with no active nonterminal attempt.
    const attemptMediaIds = new Set(
      (attempts as UploadAttemptProjection[])
        .filter(a => a.status === 'COMPLETED')
        .map(a => a.id),
    );

    for (const media of draftMedia) {
      const card: DraftCard = { kind: 'draft', id: media.id, result: media };
      cards.push(card);
    }

    return cards;
  }, [attempts, draftMedia, transfers]);

  const hasActiveUploads = queue.some(
    c => c.kind === 'attempt' && ['pending', 'READY', 'ACQUIRING', 'FINALIZING'].includes(c.status),
  );

  const selectableItems = queue.filter(
    c => c.kind === 'draft' || (c.kind === 'attempt' && c.status === 'COMPLETED'),
  );

  return { queue, hasActiveUploads, selectableItems };
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/features/Upload/model/useUploadQueue.ts
git commit -m "feat(upload): useUploadQueue — merges attempt projections + media + browser transfers"
```

---

### Task 13 — useUploadManager updated

**Context: sequential**

**Files:**
- Modify: `src/features/Upload/model/useUploadManager.ts`

- [ ] **Step 1: Rewrite useUploadManager**

The public API (`addFiles`, `remove`, `discardAll`, `retry`) is preserved exactly.

```ts
// src/features/Upload/model/useUploadManager.ts
import { useCallback } from 'react';
import { notify } from 'shared/lib/notifications';
import { getErrorMessage } from 'shared/lib/getErrorMessage';
import { MEDIA_UPLOAD_LIMITS } from 'entities/Media';
import { useUploadStore } from './uploadStore';
import { useUploadCommands } from './useUploadCommands';
import {
  startLocalUpload,
  startDriveUpload,
  discardAttempt,
  discardAllDraft,
  retryAttempt,
  type DriveSelection,
} from './uploadCoordinator';
import { requestDriveAccessToken } from './useGooglePicker';

function validateFileSize(file: File): void {
  const max = file.type.startsWith('video/')
    ? MEDIA_UPLOAD_LIMITS.MAX_FILE_SIZE_VIDEO
    : MEDIA_UPLOAD_LIMITS.MAX_FILE_SIZE_IMAGE;
  if (file.size > max) throw new Error(`${file.name} exceeds the maximum allowed size.`);
}

export function useUploadManager(draftId: string) {
  const commands = useUploadCommands(draftId);
  const deps = { commands, draftId };

  const addFiles = useCallback((files: File[]) => {
    for (const file of files) {
      try {
        validateFileSize(file);
        void startLocalUpload(file, deps).catch(err =>
          notify.error(`${file.name}: ${getErrorMessage(err)}`, 'Upload Failed'),
        );
      } catch (err) {
        notify.error(getErrorMessage(err), 'Upload Failed');
      }
    }
  }, [deps]);

  const addDriveSelections = useCallback((selections: DriveSelection[]) => {
    for (const sel of selections) {
      void startDriveUpload(sel, deps).catch(err =>
        notify.error(getErrorMessage(err), 'Drive Import Failed'),
      );
    }
  }, [deps]);

  const remove = useCallback(async (kind: 'uploading' | 'draft', id: string) => {
    try {
      await discardAttempt(id, deps);
    } catch (err) {
      notify.error(getErrorMessage(err), 'Delete Failed');
    }
  }, [deps]);

  const discardAll = useCallback(async () => {
    await discardAllDraft(deps);
  }, [deps]);

  const retry = useCallback((id: string) => {
    void retryAttempt(id, deps, requestDriveAccessToken).catch(err =>
      notify.error(getErrorMessage(err), 'Retry Failed'),
    );
  }, [deps]);

  return { addFiles, addDriveSelections, remove, discardAll, retry };
}
```

- [ ] **Step 2: Update UploadStep.tsx to pass `addDriveSelections` to the picker**

In `src/features/Upload/ui/steps/UploadStep.tsx`, update the `useGooglePicker` call:

```ts
const { trigger: openDrivePicker, isPickerLoading } = useGooglePicker(
  async (selections) => addDriveSelections(selections),
);
```

- [ ] **Step 3: Typecheck and run client tests**

```bash
npx tsc --noEmit
npx vitest run --project client src/features/Upload/
```

- [ ] **Step 4: Commit**

```bash
git add src/features/Upload/model/useUploadManager.ts \
        src/features/Upload/ui/steps/UploadStep.tsx
git commit -m "feat(upload): useUploadManager — composes coordinator, preserves addFiles/remove/discardAll/retry API"
```

---

## Stage 4 — Discard and publication

### Task 14 — discardDraft: service, repository, route

**Context: fresh**

**Files:**
- Modify: `src/server/services/UploadService.ts`
- Modify: `src/server/repositories/UploadAttemptRepository.ts`

- [ ] **Step 1: Write failing integration test for discardDraft**

Add to `UploadAttemptRepository.integration.test.ts`:

```ts
describe('removeCompletedDraftMedia', () => {
  it('deletes all draft MediaItems and marks attempts CLEANUP_PENDING atomically', async () => {
    const { photographerId, sessionId } = await seedPhotographerAndDraft();

    // Create two COMPLETED attempts with MediaItems.
    const [a1, a2] = await Promise.all([
      prisma.uploadAttempt.create({ data: { clientRequestId: randomUUID(), sessionId, photographerId, source: 'LOCAL', status: 'COMPLETED', cloudinaryPublicId: `p/${randomUUID()}`, expectedMediaType: 'PHOTO', expiresAt: new Date(Date.now() + 3_600_000) } }),
      prisma.uploadAttempt.create({ data: { clientRequestId: randomUUID(), sessionId, photographerId, source: 'LOCAL', status: 'COMPLETED', cloudinaryPublicId: `p/${randomUUID()}`, expectedMediaType: 'PHOTO', expiresAt: new Date(Date.now() + 3_600_000) } }),
    ]);
    await Promise.all([
      prisma.mediaItem.create({ data: { sessionId, photographerId, type: 'PHOTO', cloudinaryPublicId: a1.cloudinaryPublicId, thumbnailUrl: 't', lightboxUrl: 'l', capturedAt: new Date(), uploadAttemptId: a1.id } }),
      prisma.mediaItem.create({ data: { sessionId, photographerId, type: 'PHOTO', cloudinaryPublicId: a2.cloudinaryPublicId, thumbnailUrl: 't', lightboxUrl: 'l', capturedAt: new Date(), uploadAttemptId: a2.id } }),
    ]);

    const cancelled = await repo.removeCompletedDraftMedia(sessionId, photographerId);

    expect(await prisma.mediaItem.count({ where: { sessionId, deletedAt: null } })).toBe(0);
    expect(cancelled).toHaveLength(2);
    for (const id of [a1.id, a2.id]) {
      const a = await prisma.uploadAttempt.findUniqueOrThrow({ where: { id } });
      expect(a.status).toBe('CLEANUP_PENDING');
    }
  });
});
```

- [ ] **Step 2: Run test to confirm failure**

```bash
npx vitest run --project integration src/server/repositories/UploadAttemptRepository.integration.test.ts
```

Expected: `removeCompletedDraftMedia` not found.

- [ ] **Step 3: Add removeCompletedDraftMedia to repository**

Add to `UploadAttemptRepository.ts`:

```ts
  removeCompletedDraftMedia(
    sessionId: string,
    photographerId: string,
  ): Promise<Array<{ cloudinaryPublicId: string; resourceType: MediaType }>> {
    return runQuery(async () => {
      return prisma.$transaction(async (tx) => {
        // Claim all nonterminal attempts for this draft.
        await tx.uploadAttempt.updateMany({
          where: {
            sessionId,
            photographerId,
            status: { in: ['READY', 'ACQUIRING', 'FINALIZING', 'FAILED', 'CANCEL_REQUESTED'] },
          },
          data: { status: 'CANCEL_REQUESTED' },
        });

        // Collect COMPLETED attempt asset identities before deleting media.
        const completedAttempts = await tx.uploadAttempt.findMany({
          where: { sessionId, photographerId, status: 'COMPLETED' },
          select: { id: true, cloudinaryPublicId: true, expectedMediaType: true },
        });

        if (completedAttempts.length > 0) {
          await tx.mediaItem.deleteMany({
            where: {
              uploadAttemptId: { in: completedAttempts.map(a => a.id) },
              deletedAt: null,
            },
          });
          await tx.uploadAttempt.updateMany({
            where: { id: { in: completedAttempts.map(a => a.id) } },
            data: { status: 'CLEANUP_PENDING' },
          });
        }

        return completedAttempts.map(a => ({
          cloudinaryPublicId: a.cloudinaryPublicId,
          resourceType: a.expectedMediaType,
        }));
      });
    });
  }
```

Also add to `IUploadAttemptRepository`:
```ts
removeCompletedDraftMedia(sessionId: string, photographerId: string): Promise<Array<{ cloudinaryPublicId: string; resourceType: MediaType }>>;
```

- [ ] **Step 4: Add discardDraft to UploadService**

```ts
  async discardDraft(photographerId: string, draftId: string): Promise<void> {
    const draft = await this.sessions.findDraftById(draftId);
    if (!draft) throw new NotFoundError('Surf Session');
    if (draft.photographerId !== photographerId) throw new ForbiddenError('You do not have permission');

    const assetsToClean = await this.repo.removeCompletedDraftMedia(draftId, photographerId);

    // Best-effort provider cleanup — failures leave CLEANUP_PENDING for reconciler.
    await Promise.allSettled(
      assetsToClean.map(asset =>
        this.cleanup.deleteAsset({ cloudinaryPublicId: asset.cloudinaryPublicId, resourceType: asset.resourceType }),
      ),
    );
  }

  async discardAttempt(photographerId: string, attemptId: string): Promise<void> {
    await this.repo.cancelAttempt(attemptId, photographerId);
    // Provider cleanup for completed attempts.
    const attempt = await this.repo.findByIdForPhotographer(attemptId, photographerId);
    if (attempt?.status === 'CANCEL_REQUESTED' && attempt.cloudinaryPublicId) {
      void this.cleanup.deleteAsset({ cloudinaryPublicId: attempt.cloudinaryPublicId, resourceType: 'PHOTO' })
        .catch(() => { /* logged by reconciler */ });
    }
  }
```

- [ ] **Step 5: Run integration tests**

```bash
npx vitest run --project integration src/server/repositories/UploadAttemptRepository.integration.test.ts
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/server/repositories/UploadAttemptRepository.ts \
        src/server/services/UploadService.ts
git commit -m "feat(upload): discardDraft — atomic DB cleanup + best-effort provider cleanup"
```

---

### Task 15 — SurfSession publish policy

**Context: sequential**

**Files:**
- Modify: `src/server/repositories/SurfSessionRepository.ts`
- Modify: `src/server/services/SurfSessionService.ts`

- [ ] **Step 1: Write failing server test for publish guard**

Add to `src/server/services/SurfSessionService.test.ts` (or create it):

```ts
it('rejects publish when the draft has blocking upload attempts', async () => {
  vi.mocked(mockRepository.findDraftById).mockResolvedValue({
    id: 'session-1', photographerId: 'user-1', status: 'DRAFT', mediaCount: 2,
  } as never);
  vi.mocked(mockAttemptRepo.hasBlockingAttempts).mockResolvedValue(true);

  await expect(service.publish('user-1', 'session-1')).rejects.toThrow('active upload');
});
```

- [ ] **Step 2: Add hasBlockingAttempts check to SurfSessionService.publish**

```ts
// In SurfSessionService.ts — update the publish method:
async publish(photographerId: string, sessionId: string): Promise<{ mediaIds: string[] }> {
  const session = await this.sessions.findDraftById(sessionId);
  if (!session) throw new NotFoundError('Surf Session');
  if (session.photographerId !== photographerId) throw new ForbiddenError('...');

  const hasBlocking = await uploadAttemptRepository.hasBlockingAttempts(sessionId);
  if (hasBlocking) throw new BadRequestError('Cannot publish while uploads are still in progress or failed. Resolve or discard them first.');

  return this.sessions.publish(sessionId, photographerId);
}
```

- [ ] **Step 3: Run server tests**

```bash
npx vitest run --project server src/server/services/SurfSessionService.test.ts
```

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/server/services/SurfSessionService.ts
git commit -m "feat(upload): publish policy — reject when blocking upload attempts exist"
```

---

### Task 16 — StepModeModal async discardAll + useClearUploadQueue

**Context: sequential**

**Files:**
- Modify: `src/features/Upload/ui/UploadGallery/StepModeModal.tsx`
- Modify: `src/features/Upload/model/useClearUploadQueue.ts`

- [ ] **Step 1: Make StepModeModal await discardAll**

Change `handleCancelAll` in `StepModeModal.tsx`:

```ts
const handleCancelAll = useCallback(async () => {
  try {
    await onDiscardAll();
    onClose();
  } catch {
    // Modal stays open; error notification is handled inside discardAll/coordinator.
  }
}, [onDiscardAll, onClose]);
```

Update the `StepModeModalProps` interface:
```ts
onDiscardAll: () => Promise<void>;
```

Update `UploadStep.tsx` to pass the new async signature:
```ts
onDiscardAll={discardAll}
```

- [ ] **Step 2: Simplify useClearUploadQueue**

```ts
// src/features/Upload/model/useClearUploadQueue.ts
import { useCallback } from 'react';
import { useUploadStore } from './uploadStore';
import { revokeBlobUrl } from './types';

/**
 * Post-publish cleanup. Releases browser-only resources.
 * Does NOT call the server — publish policy ensures no nonterminal attempts remain.
 */
export function useClearUploadQueue() {
  return useCallback(() => {
    const transfers = useUploadStore.getState().getAll();
    transfers.forEach(t => {
      if (t.source === 'local') {
        if (t.abort) try { t.abort(); } catch { /* expected */ }
        revokeBlobUrl(t.previewUrl);
      }
    });
    useUploadStore.getState().clearTransfers();
  }, []);
}
```

- [ ] **Step 3: Run client tests**

```bash
npx vitest run --project client src/features/Upload/
```

- [ ] **Step 4: Commit**

```bash
git add src/features/Upload/ui/UploadGallery/StepModeModal.tsx \
        src/features/Upload/model/useClearUploadQueue.ts
git commit -m "feat(upload): StepModeModal awaits discardAll; useClearUploadQueue releases browser resources only"
```

---

## Stage 5 — Reconciliation and observability

### Task 17 — Reconciler, structured logging, counters

**Context: fresh**

**Files:**
- Create: `src/server/jobs/reconcileUploadAttempts.ts`

- [ ] **Step 1: Add reconciliation query to repository**

Add to `UploadAttemptRepository.ts`:

```ts
  /** Returns expired attempts that need provider cleanup. */
  findExpiredForReconciliation(): Promise<Array<{
    id: string;
    cloudinaryPublicId: string;
    expectedMediaType: MediaType;
    status: UploadAttemptStatus;
  }>> {
    return runQuery(() =>
      prisma.uploadAttempt.findMany({
        where: {
          status: { in: ['READY', 'FAILED', 'CANCEL_REQUESTED', 'CLEANUP_PENDING'] },
          expiresAt: { lt: new Date() },
        },
        select: { id: true, cloudinaryPublicId: true, expectedMediaType: true, status: true },
        take: 100,  // process in batches
      }),
    );
  }

  markCancelled(attemptId: string): Promise<void> {
    return runQuery(async () => {
      await prisma.uploadAttempt.updateMany({
        where: { id: attemptId, status: { in: ['CANCEL_REQUESTED', 'CLEANUP_PENDING'] } },
        data: { status: 'CANCELLED' },
      });
    });
  }
```

- [ ] **Step 2: Implement reconciler job**

```ts
// src/server/jobs/reconcileUploadAttempts.ts
import { logger } from 'shared/lib/logger';
import { uploadAttemptRepository } from 'server/repositories/UploadAttemptRepository';
import { cloudinaryService } from 'server/services/CloudinaryService';

export async function reconcileUploadAttempts(): Promise<void> {
  const candidates = await uploadAttemptRepository.findExpiredForReconciliation();
  logger.info('[reconciler] found candidates', { count: candidates.length });

  let cleaned = 0;
  let failed = 0;

  for (const attempt of candidates) {
    try {
      await cloudinaryService.deleteAsset(
        attempt.cloudinaryPublicId,
        attempt.expectedMediaType === 'VIDEO' ? 'video' : 'image',
      );
      await uploadAttemptRepository.markCancelled(attempt.id);
      cleaned++;
      logger.info('[reconciler] cleaned attempt', { attemptId: attempt.id });
    } catch (err) {
      failed++;
      logger.error('[reconciler] cleanup failed', { attemptId: attempt.id, err });
      // Leave in current status — next run will retry.
    }
  }

  logger.info('[reconciler] complete', { cleaned, failed });
}

// Schedule: call reconcileUploadAttempts() from your server startup or cron scheduler.
// Example with node-cron: cron.schedule('*/15 * * * *', reconcileUploadAttempts);
```

- [ ] **Step 3: Add structured logging to UploadService**

At the start of `beginLocal` and `finalizeLocal` add:

```ts
logger.info('[upload] beginLocal', { photographerId, draftId: input.draftId, clientRequestId: input.clientRequestId });
logger.info('[upload] finalizeLocal', { photographerId, attemptId: input.attemptId });
```

- [ ] **Step 4: Commit**

```bash
git add src/server/jobs/reconcileUploadAttempts.ts \
        src/server/repositories/UploadAttemptRepository.ts \
        src/server/services/UploadService.ts
git commit -m "feat(upload): reconciler for expired attempts + structured logging"
```

---

## Stage 6 — Remove legacy paths

### Task 18 — Remove legacy media upload endpoints

**Context: fresh**

**Files:**
- Modify: `src/server/routes/media.ts`
- Modify: `src/server/services/MediaService.ts`
- Delete (or gut): `src/features/Upload/model/mediaApi.ts`
- Modify: `src/features/Upload/model/index.ts`

Only run this task after both local and Drive uploads are fully using `uploadsRouter` in production. Verify by checking that `media.signCloudinary`, `media.create`, `media.registerDriveImport`, and `media.deleteOrphanAsset` have zero callers.

- [ ] **Step 1: Confirm zero callers of legacy endpoints**

```bash
grep -r "signCloudinary\|media\.create\|registerDriveImport\|deleteOrphanAsset\|mediaApi" src/ --include="*.ts" --include="*.tsx" | grep -v "media\.ts\|MediaService\|mediaSchemas"
```

Expected: no matches. If matches exist, stop — legacy paths are still in use.

- [ ] **Step 2: Remove from mediaRouter**

Remove these procedures from `src/server/routes/media.ts`:
- `signCloudinary`
- `create`
- `deleteOrphanAsset`
- `registerDriveImport`

Remove the `signCloudinaryLimiter` and its import.

- [ ] **Step 3: Remove from MediaService**

Remove `generateUploadSignature`, `createMedia`, `deleteOrphanAsset`, `registerDriveImport` methods and their `CreateMediaInput` / `RegisterDriveImportInput` types from `MediaService.ts`.

- [ ] **Step 4: Delete mediaApi.ts**

```bash
rm src/features/Upload/model/mediaApi.ts
```

Update `src/features/Upload/model/index.ts` to remove the export.

- [ ] **Step 5: Typecheck and build**

```bash
npx tsc --noEmit
npm run build
npx vitest run
```

Expected: all clean. Fix any remaining references.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(upload): remove legacy media.signCloudinary / create / registerDriveImport / deleteOrphanAsset"
```

---

### Task 19 — Lint boundaries

**Context: sequential**

**Files:**
- Modify: `eslint.config.js`

- [ ] **Step 1: Add import restriction rules**

Add to the `eslint.config.js` rules for the `src/features/` scope to prevent feature code from importing the raw tRPC client or provider SDKs directly:

```js
{
  files: ['src/features/**/*.ts', 'src/features/**/*.tsx'],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [
        {
          group: ['server/providers/*', 'cloudinary', '@cloudinary/*'],
          message: 'Feature code must not import provider SDKs directly. Use a port or command hook.',
        },
        {
          group: ['shared/lib/trpcClient'],
          message: 'Feature code must use useUploadCommands (or equivalent hooks) rather than the raw tRPC client.',
        },
      ],
    }],
  },
},
```

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Expected: no new errors (the raw client was already removed in Task 18).

- [ ] **Step 3: Commit**

```bash
git add eslint.config.js
git commit -m "feat(upload): lint boundary — prevent features importing raw tRPC client or provider SDKs"
```

---

## Verification sequence

Run this in order after all tasks complete:

```bash
npm run test:db:up
npx vitest run --project integration
npx vitest run --project server
npx vitest run --project client
npm run lint
npm run build
npm run test:db:down
```

All commands must exit 0.
