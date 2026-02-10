/**
 * MediaRepository - Data access layer for MediaItem
 *
 * Abstracts database operations to satisfy Dependency Inversion Principle.
 * Enables testing by allowing mock implementations.
 */

import { MediaItem as PrismaMediaItem, MediaType, MediaStatus } from '@prisma/client';
import { prisma } from '../prismaClient';
import { MEDIA_STATUS } from 'entities/Media/constants';

/**
 * Filter options for querying media items
 */
export interface MediaFilter {
  photographerId?: string;
  spotId?: string;
  status?: MediaStatus;
}

/**
 * Interface for MediaItem repository operations
 * Depend on this abstraction, not concrete Prisma implementation
 */
export interface IMediaRepository {
  create(data: MediaCreateInput): Promise<PrismaMediaItem>;
  findById(id: string): Promise<PrismaMediaItem | null>;
  findMany(filter: MediaFilter): Promise<PrismaMediaItem[]>;
  update(id: string, data: MediaUpdateInput): Promise<PrismaMediaItem>;
  softDelete(id: string): Promise<PrismaMediaItem>;
  hardDelete(id: string): Promise<void>;
}

/**
 * Input types for repository operations
 */
export interface MediaCreateInput {
  spotId: string;
  photographerId: string;
  type: MediaType;
  originalUrl: string;
  watermarkUrl: string;
  capturedAt: Date;
  price: number;
  status: MediaStatus;
}

export interface MediaUpdateInput {
  price?: number;
  status?: MediaStatus;
  capturedAt?: Date;
}

/**
 * Prisma implementation of MediaRepository
 * Default implementation using Prisma ORM
 */
export class PrismaMediaRepository implements IMediaRepository {
  async create(data: MediaCreateInput): Promise<PrismaMediaItem> {
    return prisma.mediaItem.create({ data });
  }

  async findById(id: string): Promise<PrismaMediaItem | null> {
    return prisma.mediaItem.findUnique({ where: { id } });
  }

  async update(id: string, data: MediaUpdateInput): Promise<PrismaMediaItem> {
    return prisma.mediaItem.update({
      where: { id },
      data,
    });
  }

  async softDelete(id: string): Promise<PrismaMediaItem> {
    return prisma.mediaItem.update({
      where: { id },
      data: {
        status: MEDIA_STATUS.DELETED,
        deletedAt: new Date(),
      },
    });
  }

  async hardDelete(id: string): Promise<void> {
    await prisma.mediaItem.delete({
      where: { id },
    });
  }

  async findMany(filter: MediaFilter): Promise<PrismaMediaItem[]> {
    return prisma.mediaItem.findMany({
      where: filter,
      orderBy: { capturedAt: 'desc' },
    });
  }
}

/**
 * Singleton instance - reuse across server actions
 */
export const mediaRepository: IMediaRepository = new PrismaMediaRepository();
