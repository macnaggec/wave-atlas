import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
  log: ['query', 'info', 'warn', 'error'],
});

async function main() {
  // Clear existing data
  await prisma.purchase.deleteMany();
  await prisma.mediaItem.deleteMany();
  await prisma.spot.deleteMany();
  await prisma.user.deleteMany();

  // Create Photographer
  const photographer = await prisma.user.create({
    data: {
      email: "photographer@example.com",
      name: "Surfer Joe",
      password: "hashed_password_here"
    }
  });

  // Bali Spots with Coordinates
  const spots = [
    {
      name: "Uluwatu",
      location: "Bali, Indonesia",
      lat: -8.814917,
      lng: 115.088466
    },
    {
      name: "Padang Padang",
      location: "Bali, Indonesia",
      lat: -8.811135,
      lng: 115.103247
    },
    {
      name: "Bingin",
      location: "Bali, Indonesia",
      lat: -8.805727,
      lng: 115.113028
    },
    {
      name: "Canggu (Batu Bolong)",
      location: "Bali, Indonesia",
      lat: -8.659586,
      lng: 115.130138
    },
  ];

  for (const spot of spots) {
    await prisma.spot.create({
      data: {
        name: spot.name,
        location: spot.location,
        lat: spot.lat,
        lng: spot.lng,
        mediaItems: {
          create: [
            {
              type: 'PHOTO',
              photographerId: photographer.id,
              price: 5.00,
              watermarkUrl: 'https://images.unsplash.com/photo-1502680390469-be75c86b636f?auto=format&fit=crop&q=80&w=400',
              originalUrl: 'https://images.unsplash.com/photo-1502680390469-be75c86b636f',
              capturedAt: new Date(),
            },
            {
              type: 'VIDEO',
              photographerId: photographer.id,
              price: 15.00,
              watermarkUrl: 'https://images.unsplash.com/photo-1498307833015-e7b400441eb8?auto=format&fit=crop&q=80&w=400',
              originalUrl: 'https://images.unsplash.com/photo-1498307833015-e7b400441eb8',
              capturedAt: new Date(),
            }
          ]
        }
      }
    });
  }

  console.log('✅ Spots seeded with photos and videos!');
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
