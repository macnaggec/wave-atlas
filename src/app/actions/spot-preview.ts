'use server';

import { z } from 'zod';
import { prisma } from 'shared/api/prismaClient';
import { createAction } from 'shared/lib/safeAction';

export type SpotPreviewData = {
  id: string;
  name: string;
  location: string | null;
  media: {
    id: string;
    url: string;
    type: 'PHOTO' | 'VIDEO';
  }[];
  totalMedia: number;
};

// Accept string ID (UUID)
const spotPreviewSchema = z.string();

export const getSpotPreviewData = createAction(
  spotPreviewSchema,
  async (spotId: string): Promise<SpotPreviewData | null> => {
    if (!spotId) return null;

    const spot = await prisma.spot.findUnique({
      where: { id: spotId },
      select: {
        id: true,
        name: true,
        location: true,
        _count: {
          select: { mediaItems: true },
        },
        mediaItems: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            watermarkUrl: true,
            type: true,
          }
        }
      },
    });

    if (!spot) return null;

    return {
      id: spot.id,
      name: spot.name,
      location: spot.location,
      media: spot.mediaItems.map(item => ({
        id: item.id,
        url: item.watermarkUrl,
        type: item.type,
      })),
      totalMedia: spot._count.mediaItems,
    };
  }
);
