'use server';

import { prisma } from 'shared/api/prismaClient';
import { Spot } from 'entities/Spot/types';
import { SPOT_STATUS, SpotStatus } from 'entities/Spot/constants';
import { revalidatePath } from 'next/cache';
import { createAction } from 'shared/lib/safeAction';
import { z } from 'zod';

const addSpotSchema = z.object({
  name: z.string().min(2),
  coords: z.tuple([z.number(), z.number()]),
  location: z.string().optional(),
});

/**
 * Server Action: Add a new spot
 */
export const addSpot = createAction(
  addSpotSchema,
  async (params): Promise<Spot> => {
    const { name, coords, location } = params;
    const [lat, lng] = coords;

    const spot = await prisma.spot.create({
      data: {
        name,
        location: location || name,
        lat,
        lng,
      },
    });

    revalidatePath('/upload');

    return {
      id: spot.id,
      name: spot.name,
      location: spot.location,
      coords: [Number(spot.lat), Number(spot.lng)],
    };
  }
);

const getSpotSchema = z.string();

/**
 * Server Action: Get spot by ID
 */
export const getSpot = createAction(
  getSpotSchema,
  async (id): Promise<Spot | null> => {
    const spot = await prisma.spot.findUnique({
      where: { id },
    });

    if (!spot) return null;

    return {
      id: spot.id,
      name: spot.name,
      location: spot.location,
      coords: [
        spot.lat ? Number(spot.lat) : 0,
        spot.lng ? Number(spot.lng) : 0,
      ],
    };
  }
);

const getSpotsSchema = z.string().optional();

/**
 * Server Action: Get spots with optional search filter
 */
export const getSpots = createAction(
  getSpotsSchema,
  async (search): Promise<Spot[]> => {
    const spots = await prisma.spot.findMany({
      where: {
        AND: [
          // Filter out spots without valid coordinates to prevent "Null Island"
          { lat: { not: null } },
          { lng: { not: null } },
          search ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { location: { contains: search, mode: 'insensitive' } },
            ],
          } : {},
        ],
      },
      orderBy: { name: 'asc' },
    });

    return spots.map(spot => ({
      id: spot.id,
      name: spot.name,
      location: spot.location,
      coords: [
        Number(spot.lat),
        Number(spot.lng)
      ] as [number, number],
      status: (spot.status as SpotStatus) || SPOT_STATUS.VERIFIED,
    }));
  }
);
