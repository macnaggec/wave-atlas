import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from 'server/db';
import { SurfSessionRepository } from './SurfSessionRepository';
import { SurfSessionService } from 'server/services/SurfSessionService';
import { randomUUID } from 'node:crypto';

const repository = new SurfSessionRepository();
const service = new SurfSessionService(repository);

async function clearTestData() {
  await prisma.mediaItem.deleteMany();
  await prisma.surfSession.deleteMany();
  await prisma.spot.deleteMany();
  await prisma.user.deleteMany();
}

beforeEach(clearTestData);
afterAll(async () => {
  await clearTestData();
  await prisma.$disconnect();
});

describe('SurfSessionService.create', () => {
  it('returns one active draft when creation requests race', async () => {
    const photographer = await prisma.user.create({
      data: { email: 'draft-race@example.com' },
    });
    const input = {
      startsAt: new Date('2026-01-01T06:00:00Z'),
      endsAt: new Date('2026-01-01T08:00:00Z'),
    };

    const [first, second] = await Promise.all([
      service.create(photographer.id, input),
      service.create(photographer.id, input),
    ]);

    expect(second.id).toBe(first.id);
    expect(await prisma.surfSession.count({
      where: { photographerId: photographer.id, status: 'DRAFT' },
    })).toBe(1);
  });
});

describe('SurfSession time window constraint', () => {
  it('rejects persisting a complete session whose end is before its start', async () => {
    const photographer = await prisma.user.create({
      data: { email: 'invalid-window@example.com' },
    });

    await expect(prisma.surfSession.create({
      data: {
        photographerId: photographer.id,
        startsAt: new Date('2026-01-01T09:00:00Z'),
        endsAt: new Date('2026-01-01T08:00:00Z'),
      },
    })).rejects.toThrow();
  });
});

describe('SurfSession media ownership constraint', () => {
  it('rejects persisting media without a surf session', async () => {
    const photographer = await prisma.user.create({
      data: { email: 'sessionless-media@example.com' },
    });

    await expect(prisma.$executeRaw`
      INSERT INTO media_items (
        id,
        photographer_id,
        captured_at,
        lightbox_url,
        cloudinary_public_id,
        thumbnail_url
      ) VALUES (
        ${randomUUID()},
        ${photographer.id},
        ${new Date('2026-01-01T06:30:00Z')},
        ${'https://res.cloudinary.com/test/sessionless.jpg'},
        ${'wave-atlas/users/test/sessionless'},
        ${'https://res.cloudinary.com/test/sessionless-thumb.jpg'}
      )
    `).rejects.toThrow();
  });

  it('removes draft media only through its owning session', async () => {
    const photographer = await prisma.user.create({
      data: { email: 'remove-draft-media@example.com' },
    });
    const draft = await prisma.surfSession.create({
      data: { photographerId: photographer.id },
    });
    const media = await prisma.mediaItem.create({
      data: {
        sessionId: draft.id,
        photographerId: photographer.id,
        capturedAt: new Date('2026-01-01T06:30:00Z'),
        lightboxUrl: 'https://res.cloudinary.com/test/remove.jpg',
        thumbnailUrl: 'https://res.cloudinary.com/test/remove-thumb.jpg',
        cloudinaryPublicId: 'wave-atlas/users/test/remove',
      },
    });

    await repository.removeDraftMedia(draft.id, photographer.id, media.id);

    expect(await prisma.mediaItem.findUnique({ where: { id: media.id } })).toBeNull();
    expect(await prisma.surfSession.findUnique({ where: { id: draft.id } })).not.toBeNull();
  });

  it('rejects a batch spanning more than one draft without deleting any media', async () => {
    const firstPhotographer = await prisma.user.create({
      data: { email: 'first-batch-owner@example.com' },
    });
    const secondPhotographer = await prisma.user.create({
      data: { email: 'second-batch-owner@example.com' },
    });
    const firstDraft = await prisma.surfSession.create({
      data: { photographerId: firstPhotographer.id },
    });
    const secondDraft = await prisma.surfSession.create({
      data: { photographerId: secondPhotographer.id },
    });
    const firstMedia = await prisma.mediaItem.create({
      data: {
        sessionId: firstDraft.id,
        photographerId: firstPhotographer.id,
        capturedAt: new Date('2026-01-01T06:30:00Z'),
        lightboxUrl: 'https://res.cloudinary.com/test/first.jpg',
        thumbnailUrl: 'https://res.cloudinary.com/test/first-thumb.jpg',
        cloudinaryPublicId: 'wave-atlas/users/test/first',
      },
    });
    const secondMedia = await prisma.mediaItem.create({
      data: {
        sessionId: secondDraft.id,
        photographerId: secondPhotographer.id,
        capturedAt: new Date('2026-01-01T07:00:00Z'),
        lightboxUrl: 'https://res.cloudinary.com/test/second.jpg',
        thumbnailUrl: 'https://res.cloudinary.com/test/second-thumb.jpg',
        cloudinaryPublicId: 'wave-atlas/users/test/second',
      },
    });

    await expect(repository.removeDraftMediaBatch(
      firstDraft.id,
      firstPhotographer.id,
      [firstMedia.id, secondMedia.id],
    )).rejects.toThrow();

    expect(await prisma.mediaItem.count({
      where: { id: { in: [firstMedia.id, secondMedia.id] } },
    })).toBe(2);
  });
});

describe('SurfSessionRepository.publish', () => {
  it('transitions the existing draft and prices only its attached media', async () => {
    const photographer = await prisma.user.create({
      data: { email: 'photographer@example.com' },
    });
    const spot = await prisma.spot.create({
      data: { name: 'Pipeline', location: 'North Shore' },
    });
    const draft = await prisma.surfSession.create({
      data: {
        photographerId: photographer.id,
        spotId: spot.id,
        startsAt: new Date('2026-01-01T06:00:00Z'),
        endsAt: new Date('2026-01-01T08:00:00Z'),
        photoPrice: 700,
        videoPrice: 1200,
      },
    });
    const photo = await prisma.mediaItem.create({
      data: {
        sessionId: draft.id,
        photographerId: photographer.id,
        type: 'PHOTO',
        capturedAt: new Date('2026-01-01T06:30:00Z'),
        lightboxUrl: 'https://res.cloudinary.com/test/photo.jpg',
        thumbnailUrl: 'https://res.cloudinary.com/test/photo-thumb.jpg',
        cloudinaryPublicId: 'wave-atlas/users/test/photo',
      },
    });
    const video = await prisma.mediaItem.create({
      data: {
        sessionId: draft.id,
        photographerId: photographer.id,
        type: 'VIDEO',
        capturedAt: new Date('2026-01-01T07:00:00Z'),
        lightboxUrl: 'https://res.cloudinary.com/test/video.jpg',
        thumbnailUrl: 'https://res.cloudinary.com/test/video-thumb.jpg',
        cloudinaryPublicId: 'wave-atlas/users/test/video',
      },
    });
    const result = await repository.publish(draft.id, photographer.id);

    expect(result.mediaIds).toEqual(expect.arrayContaining([photo.id, video.id]));
    expect(await prisma.surfSession.count({ where: { photographerId: photographer.id } })).toBe(1);
    expect(await prisma.surfSession.findUnique({ where: { id: draft.id } })).toMatchObject({
      id: draft.id,
      status: 'PUBLISHED',
    });
    expect(await prisma.mediaItem.findUnique({ where: { id: photo.id } })).toMatchObject({
      status: 'PUBLISHED',
      spotId: spot.id,
      price: 700,
    });
    expect(await prisma.mediaItem.findUnique({ where: { id: video.id } })).toMatchObject({
      status: 'PUBLISHED',
      spotId: spot.id,
      price: 1200,
    });
  });

  it('rejects the complete draft when any attached media is not publishable', async () => {
    const photographer = await prisma.user.create({
      data: { email: 'invalid-member@example.com' },
    });
    const spot = await prisma.spot.create({
      data: { name: 'Backdoor', location: 'North Shore' },
    });
    const draft = await prisma.surfSession.create({
      data: {
        photographerId: photographer.id,
        spotId: spot.id,
        startsAt: new Date('2026-01-01T06:00:00Z'),
        endsAt: new Date('2026-01-01T08:00:00Z'),
      },
    });
    const validMedia = await prisma.mediaItem.create({
      data: {
        sessionId: draft.id,
        photographerId: photographer.id,
        capturedAt: new Date('2026-01-01T06:30:00Z'),
        lightboxUrl: 'https://res.cloudinary.com/test/valid.jpg',
        thumbnailUrl: 'https://res.cloudinary.com/test/valid-thumb.jpg',
        cloudinaryPublicId: 'wave-atlas/users/test/valid',
      },
    });
    await prisma.mediaItem.create({
      data: {
        sessionId: draft.id,
        photographerId: photographer.id,
        status: 'DELETED',
        deletedAt: new Date('2026-01-01T07:15:00Z'),
        capturedAt: new Date('2026-01-01T07:00:00Z'),
        lightboxUrl: 'https://res.cloudinary.com/test/deleted.jpg',
        thumbnailUrl: 'https://res.cloudinary.com/test/deleted-thumb.jpg',
        cloudinaryPublicId: 'wave-atlas/users/test/deleted',
      },
    });

    await expect(repository.publish(draft.id, photographer.id)).rejects.toThrow();

    expect(await prisma.surfSession.findUnique({ where: { id: draft.id } })).toMatchObject({
      status: 'DRAFT',
    });
    expect(await prisma.mediaItem.findUnique({ where: { id: validMedia.id } })).toMatchObject({
      status: 'DRAFT',
      price: null,
    });
  });
});
