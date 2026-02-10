import { PrismaClient } from '@prisma/client';
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
  // Get all users and spots to show options
  const users = await prisma.user.findMany();
  const spots = await prisma.spot.findMany();

  console.log('\n📋 Available Users:');
  users.forEach((user, idx) => {
    console.log(`  ${idx + 1}. ${user.email} (ID: ${user.id})`);
  });

  console.log('\n📍 Available Spots:');
  spots.forEach((spot, idx) => {
    console.log(`  ${idx + 1}. ${spot.name} (ID: ${spot.id})`);
  });

  // Use the first user and first spot if available
  if (users.length === 0 || spots.length === 0) {
    console.error('❌ No users or spots found. Run main seed script first.');
    process.exit(1);
  }

  // Find test@test.com user, or fall back to first user
  const targetUser = users.find(u => u.email === 'test@test.com') || users[0];
  const targetSpot = spots[0];

  console.log(`\n🎯 Creating drafts for: ${targetUser.email} at ${targetSpot.name}`);

  // Delete existing drafts for this user at this spot
  const deleted = await prisma.mediaItem.deleteMany({
    where: {
      photographerId: targetUser.id,
      spotId: targetSpot.id,
      status: 'DRAFT',
    },
  });

  console.log(`🗑️  Deleted ${deleted.count} existing drafts`);

  // Create 30 draft media items for scrolling tests
  const draftItems = [];
  const now = new Date();

  for (let i = 1; i <= 30; i++) {
    const isVideo = i % 5 === 0;
    const capturedAt = new Date(now);
    capturedAt.setDate(capturedAt.getDate() - i);

    draftItems.push({
      type: isVideo ? ('VIDEO' as const) : ('PHOTO' as const),
      photographerId: targetUser.id,
      spotId: targetSpot.id,
      price: isVideo ? 15.00 : 5.00,
      watermarkUrl: isVideo
        ? `https://images.unsplash.com/photo-150${1480 + i}?auto=format&fit=crop&q=80&w=400`
        : `https://images.unsplash.com/photo-150${2680 + i}?auto=format&fit=crop&q=80&w=400`,
      originalUrl: isVideo
        ? `https://images.unsplash.com/photo-150${1480 + i}`
        : `https://images.unsplash.com/photo-150${2680 + i}`,
      capturedAt,
      status: 'DRAFT' as const,
    });
  }

  await prisma.mediaItem.createMany({
    data: draftItems,
  });

  console.log(`✅ Created ${draftItems.length} draft media items`);
  console.log(`   User: ${targetUser.email}`);
  console.log(`   Spot: ${targetSpot.name}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
