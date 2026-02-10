import { PrismaClient, MediaType, MediaStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
  log: ['query', 'info', 'warn', 'error'],
});

async function main() {
  // Get the photographer and first spot
  const photographer = await prisma.user.findFirst({
    where: { email: "photographer@example.com" }
  });

  if (!photographer) {
    console.error('❌ Photographer not found. Run seed script first.');
    process.exit(1);
  }

  const spot = await prisma.spot.findFirst();

  if (!spot) {
    console.error('❌ No spots found. Run seed script first.');
    process.exit(1);
  }

  // Create 30 draft media items for scrolling tests
  const draftItems = [];
  const now = new Date();

  for (let i = 1; i <= 30; i++) {
    const isVideo = i % 5 === 0; // Every 5th item is a video
    const capturedAt = new Date(now);
    capturedAt.setDate(capturedAt.getDate() - i); // Spread out over past 30 days

    draftItems.push({
      type: isVideo ? MediaType.VIDEO : MediaType.PHOTO,
      photographerId: photographer.id,
      spotId: spot.id,
      price: isVideo ? 15.00 : 5.00,
      watermarkUrl: isVideo
        ? `https://images.unsplash.com/photo-150${1480 + i}?auto=format&fit=crop&q=80&w=400`
        : `https://images.unsplash.com/photo-150${2680 + i}?auto=format&fit=crop&q=80&w=400`,
      originalUrl: isVideo
        ? `https://images.unsplash.com/photo-150${1480 + i}`
        : `https://images.unsplash.com/photo-150${2680 + i}`,
      capturedAt,
      status: MediaStatus.DRAFT,
    });
  }

  // Insert all draft items
  await prisma.mediaItem.createMany({
    data: draftItems,
  });

  console.log(`✅ Created ${draftItems.length} draft media items for spot: ${spot.name}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
