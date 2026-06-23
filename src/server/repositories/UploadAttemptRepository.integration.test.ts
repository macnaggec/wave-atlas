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
