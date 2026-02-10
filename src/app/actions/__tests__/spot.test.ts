import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getSpots } from '../spot'
import { prismaMock } from 'shared/lib/test/prisma'
import { SPOT_STATUS } from 'entities/Spot/constants'
import { Prisma } from '@prisma/client'

describe('getSpots Server Action', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return all spots when no search query is provided', async () => {
    const mockSpots = [
      {
        id: '1',
        name: 'Pipeline',
        location: 'Hawaii',
        lat: new Prisma.Decimal(21.66),
        lng: new Prisma.Decimal(-158.05),
        status: 'verified',
        createdAt: new Date(),
        updatedAt: new Date(),
        description: null,
      },
      {
        id: '2',
        name: 'Superbank',
        location: 'Gold Coast',
        lat: new Prisma.Decimal(-28.16),
        lng: new Prisma.Decimal(153.54),
        status: 'verified',
        createdAt: new Date(),
        updatedAt: new Date(),
        description: null,
      },
    ]

    prismaMock.spot.findMany.mockResolvedValue(mockSpots as any)

    const result = await getSpots(undefined)

    expect(prismaMock.spot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            { lat: { not: null } },
            { lng: { not: null } },
          ]),
        }),
      })
    )

    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      id: '1',
      name: 'Pipeline',
      location: 'Hawaii',
      coords: [21.66, -158.05],
      status: SPOT_STATUS.VERIFIED,
    })
  })

  it('should filter spots by name when search query is provided', async () => {
    const query = 'Pipe'
    const mockSpots = [
      {
        id: '1',
        name: 'Pipeline',
        location: 'Hawaii',
        lat: new Prisma.Decimal(21.66),
        lng: new Prisma.Decimal(-158.05),
        status: 'verified',
        createdAt: new Date(),
        updatedAt: new Date(),
        description: null,
      },
    ]

    prismaMock.spot.findMany.mockResolvedValue(mockSpots as any)

    const result = await getSpots(query)

    expect(prismaMock.spot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            { lat: { not: null } },
            { lng: { not: null } },
            {
              OR: [
                { name: { contains: query, mode: 'insensitive' } },
                { location: { contains: query, mode: 'insensitive' } },
              ],
            },
          ],
        },
      })
    )

    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Pipeline')
  })

  it('should handle spots with missing coordinates gracefuly (by filtering them out in DB query)', async () => {
    // The logic in getSpots ensures lat/lng are not null in the query
    // So if the DB returns them, they must be valid, but let's test the return mapping
    const mockSpots = [
      {
        id: '1',
        name: 'Pipeline',
        location: 'Hawaii',
        lat: new Prisma.Decimal(21.66),
        lng: new Prisma.Decimal(-158.05),
        status: 'verified',
        createdAt: new Date(),
        updatedAt: new Date(),
        description: null,
      },
    ]

    prismaMock.spot.findMany.mockResolvedValue(mockSpots as any)

    const result = await getSpots(undefined)

    // Check type conversion from Decimal to Number
    expect(result[0].coords).toEqual([21.66, -158.05])
  })
})
