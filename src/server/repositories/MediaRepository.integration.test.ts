import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from 'server/db';
import { MediaRepository } from './MediaRepository';

const repo = new MediaRepository();

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

// ---------------------------------------------------------------------------
// findByIdsForFulfillment
// ---------------------------------------------------------------------------

describe('MediaRepository.findByIdsForFulfillment', () => {
  it('returns only PUBLISHED, priced, non-deleted rows', async () => {
    const photographer = await prisma.user.create({
      data: { email: 'fulfillment-filter@example.com' },
    });
    const session = await prisma.surfSession.create({
      data: { photographerId: photographer.id },
    });

    const base = {
      sessionId: session.id,
      photographerId: photographer.id,
      capturedAt: new Date('2026-01-01T06:30:00Z'),
      lightboxUrl: 'https://res.cloudinary.com/test/img.jpg',
      thumbnailUrl: 'https://res.cloudinary.com/test/thumb.jpg',
    };

    const published = await prisma.mediaItem.create({
      data: { ...base, status: 'PUBLISHED', price: 700, cloudinaryPublicId: 'wave-atlas/test/fulfillment-pub' },
    });
    const draft = await prisma.mediaItem.create({
      data: { ...base, status: 'DRAFT', price: 700, cloudinaryPublicId: 'wave-atlas/test/fulfillment-draft' },
    });
    const noPrice = await prisma.mediaItem.create({
      data: { ...base, status: 'PUBLISHED', price: null, cloudinaryPublicId: 'wave-atlas/test/fulfillment-no-price' },
    });
    const deleted = await prisma.mediaItem.create({
      data: { ...base, status: 'PUBLISHED', price: 700, deletedAt: new Date(), cloudinaryPublicId: 'wave-atlas/test/fulfillment-deleted' },
    });

    const results = await repo.findByIdsForFulfillment([published.id, draft.id, noPrice.id, deleted.id]);

    expect(results).toHaveLength(1);
    expect(results[0]!.id).toBe(published.id);
  });

  it('returns the correct fulfillment shape with price as a number', async () => {
    const photographer = await prisma.user.create({
      data: { email: 'fulfillment-shape@example.com' },
    });
    const session = await prisma.surfSession.create({
      data: { photographerId: photographer.id },
    });

    const media = await prisma.mediaItem.create({
      data: {
        sessionId: session.id,
        photographerId: photographer.id,
        status: 'PUBLISHED',
        price: 1500,
        capturedAt: new Date('2026-01-01T06:30:00Z'),
        lightboxUrl: 'https://res.cloudinary.com/test/shape.jpg',
        thumbnailUrl: 'https://res.cloudinary.com/test/shape-thumb.jpg',
        cloudinaryPublicId: 'wave-atlas/users/test/shape',
      },
    });

    const results = await repo.findByIdsForFulfillment([media.id]);

    expect(results).toEqual([{
      id: media.id,
      price: 1500,
      photographerId: photographer.id,
      cloudinaryPublicId: 'wave-atlas/users/test/shape',
    }]);
  });
});

// ---------------------------------------------------------------------------
// findPublishedBySpot
// ---------------------------------------------------------------------------

describe('MediaRepository.findPublishedBySpot', () => {
  it('excludes draft and deleted rows, returns only PUBLISHED non-deleted for the given spot', async () => {
    const photographer = await prisma.user.create({
      data: { email: 'spot-filter@example.com' },
    });
    const spot = await prisma.spot.create({ data: { name: 'Backdoor', location: 'North Shore' } });
    const session = await prisma.surfSession.create({
      data: { photographerId: photographer.id },
    });

    const base = {
      sessionId: session.id,
      photographerId: photographer.id,
      spotId: spot.id,
      capturedAt: new Date('2026-01-01T06:30:00Z'),
      lightboxUrl: 'https://res.cloudinary.com/test/filter.jpg',
      thumbnailUrl: 'https://res.cloudinary.com/test/filter-thumb.jpg',
    };

    const published = await prisma.mediaItem.create({
      data: { ...base, status: 'PUBLISHED', cloudinaryPublicId: 'wave-atlas/test/spot-pub' },
    });
    await prisma.mediaItem.create({
      data: { ...base, status: 'DRAFT', cloudinaryPublicId: 'wave-atlas/test/spot-draft' },
    });
    await prisma.mediaItem.create({
      data: { ...base, status: 'PUBLISHED', deletedAt: new Date(), cloudinaryPublicId: 'wave-atlas/test/spot-deleted' },
    });

    const { items } = await repo.findPublishedBySpot(spot.id, undefined, 10);

    expect(items).toHaveLength(1);
    expect(items[0]!.id).toBe(published.id);
  });

  it('returns items in capturedAt descending order by default', async () => {
    const photographer = await prisma.user.create({
      data: { email: 'spot-sort@example.com' },
    });
    const spot = await prisma.spot.create({ data: { name: 'Pipeline', location: 'North Shore' } });
    const session = await prisma.surfSession.create({
      data: { photographerId: photographer.id },
    });

    const base = {
      sessionId: session.id,
      photographerId: photographer.id,
      spotId: spot.id,
      status: 'PUBLISHED' as const,
      lightboxUrl: 'https://res.cloudinary.com/test/sort.jpg',
      thumbnailUrl: 'https://res.cloudinary.com/test/sort-thumb.jpg',
    };

    const early = await prisma.mediaItem.create({
      data: { ...base, capturedAt: new Date('2026-01-01T06:00:00Z'), cloudinaryPublicId: 'wave-atlas/test/sort-early' },
    });
    const late = await prisma.mediaItem.create({
      data: { ...base, capturedAt: new Date('2026-01-01T08:00:00Z'), cloudinaryPublicId: 'wave-atlas/test/sort-late' },
    });

    const { items } = await repo.findPublishedBySpot(spot.id, undefined, 10);

    expect(items[0]!.id).toBe(late.id);
    expect(items[1]!.id).toBe(early.id);
  });

  it('paginates: nextCursor present when more exist, null when exhausted; cursor resumes correctly', async () => {
    const photographer = await prisma.user.create({
      data: { email: 'spot-paginate@example.com' },
    });
    const spot = await prisma.spot.create({ data: { name: 'Sunset', location: 'North Shore' } });
    const session = await prisma.surfSession.create({
      data: { photographerId: photographer.id },
    });

    // Insert 4 items with distinct descending capturedAt (newest first in results)
    for (let i = 0; i < 4; i++) {
      await prisma.mediaItem.create({
        data: {
          sessionId: session.id,
          photographerId: photographer.id,
          spotId: spot.id,
          status: 'PUBLISHED',
          capturedAt: new Date(`2026-01-0${4 - i}T06:00:00Z`),
          lightboxUrl: `https://res.cloudinary.com/test/page-${i}.jpg`,
          thumbnailUrl: `https://res.cloudinary.com/test/page-${i}-thumb.jpg`,
          cloudinaryPublicId: `wave-atlas/test/paginate-${i}`,
        },
      });
    }

    const firstPage = await repo.findPublishedBySpot(spot.id, undefined, 2);
    expect(firstPage.items).toHaveLength(2);
    expect(firstPage.nextCursor).not.toBeNull();

    const secondPage = await repo.findPublishedBySpot(spot.id, firstPage.nextCursor!, 2);
    expect(secondPage.items).toHaveLength(2);
    expect(secondPage.nextCursor).toBeNull();

    const firstIds = firstPage.items.map(item => item.id);
    const secondIds = secondPage.items.map(item => item.id);
    expect(firstIds.some(id => secondIds.includes(id))).toBe(false);
  });
});
