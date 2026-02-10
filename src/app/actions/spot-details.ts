'use server';

import { z } from 'zod';
import { prisma } from 'shared/api/prismaClient';
import { createAction } from 'shared/lib/safeAction';
import { MediaType } from '@prisma/client';
import { MEDIA_STATUS } from 'entities/Media/constants';

export type SpotDetailData = {
  id: string;
  name: string;
  location: string;
  description?: string; // Not in schema yet, but good to have in type for future
  lat: number | null;
  lng: number | null;
  status: string;
  creatorName: string | null;
  media: {
    id: string;
    url: string;
    type: MediaType;
    price: number;
    photographer: {
      id: string;
      name: string | null;
    };
    capturedAt: Date;
  }[];
};

const spotDetailsSchema = z.string();

export const getSpotDetails = createAction(
  spotDetailsSchema,
  async (spotId: string): Promise<SpotDetailData | null> => {
    if (!spotId) return null;

    const spot = await prisma.spot.findUnique({
      where: { id: spotId },
      include: {
        creator: {
          select: { name: true },
        },
        mediaItems: {
          where: { status: MEDIA_STATUS.PUBLISHED },
          orderBy: { capturedAt: 'desc' },
          include: {
            photographer: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    if (!spot) return null;

    return {
      id: spot.id,
      name: spot.name,
      location: spot.location,
      lat: spot.lat ? Number(spot.lat) : null,
      lng: spot.lng ? Number(spot.lng) : null,
      status: spot.status,
      creatorName: spot.creator?.name || null,
      media: spot.mediaItems.map((m) => ({
        id: m.id,
        url: m.watermarkUrl,
        type: m.type,
        price: Number(m.price),
        photographer: m.photographer,
        capturedAt: m.capturedAt,
      })),
    };
  }
);
