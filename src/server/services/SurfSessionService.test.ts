import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SurfSessionService } from './SurfSessionService';
import type { ISurfSessionRepository } from 'server/repositories/SurfSessionRepository';
import { BadRequestError, ForbiddenError, NotFoundError } from 'shared/errors';

const sessions = {
  create: vi.fn(),
  createAndPublish: vi.fn(),
  findPublishableDraftMedia: vi.fn(),
  findById: vi.fn(),
  publish: vi.fn(),
} as unknown as ISurfSessionRepository;

const service = new SurfSessionService(sessions);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('SurfSessionService', () => {
  it('creates a draft session for the authenticated photographer', async () => {
    const startsAt = new Date('2026-01-01T06:00:00Z');
    const endsAt = new Date('2026-01-01T08:00:00Z');
    vi.mocked(sessions.create).mockResolvedValue({
      id: 'session-1',
      spotId: 'spot-1',
      startsAt,
      endsAt,
    });

    const result = await service.create('user-1', {
      spotId: 'spot-1',
      startsAt,
      endsAt,
    });

    expect(result).toEqual({
      id: 'session-1',
      spotId: 'spot-1',
      startsAt,
      endsAt,
    });
    expect(sessions.create).toHaveBeenCalledWith({
      spotId: 'spot-1',
      photographerId: 'user-1',
      startsAt,
      endsAt,
    });
  });

  it('creates and publishes a session for the authenticated photographer', async () => {
    vi.mocked(sessions.findPublishableDraftMedia).mockResolvedValue([
      { id: 'media-1', type: 'PHOTO' },
    ]);
    vi.mocked(sessions.createAndPublish).mockResolvedValue({ id: 'session-1' });

    const result = await service.createAndPublish('user-1', {
      spotId: 'spot-1',
      startsAt: new Date('2026-01-01T06:00:00Z'),
      endsAt: new Date('2026-01-01T08:00:00Z'),
      mediaIds: ['media-1'],
      photoPrice: 300,
      videoPrice: 500,
    });

    expect(result).toEqual({ id: 'session-1' });
    expect(sessions.createAndPublish).toHaveBeenCalledWith({
      spotId: 'spot-1',
      photographerId: 'user-1',
      startsAt: new Date('2026-01-01T06:00:00Z'),
      endsAt: new Date('2026-01-01T08:00:00Z'),
      mediaItems: [{ id: 'media-1', type: 'PHOTO' }],
      photoPrice: 300,
      videoPrice: 500,
    });
  });

  it('rejects duplicate media IDs before creating and publishing', async () => {
    await expect(
      service.createAndPublish('user-1', {
        spotId: 'spot-1',
        startsAt: new Date('2026-01-01T06:00:00Z'),
        endsAt: new Date('2026-01-01T08:00:00Z'),
        mediaIds: ['media-1', 'media-1'],
        photoPrice: 300,
        videoPrice: 500,
      }),
    ).rejects.toThrow(BadRequestError);

    expect(sessions.createAndPublish).not.toHaveBeenCalled();
    expect(sessions.findPublishableDraftMedia).not.toHaveBeenCalled();
  });

  it('rejects create-and-publish when any selected media is not an owned draft', async () => {
    vi.mocked(sessions.createAndPublish).mockResolvedValue({ id: 'session-1' });
    vi.mocked(sessions.findPublishableDraftMedia).mockResolvedValue([
      { id: 'media-1', type: 'PHOTO' },
    ]);

    await expect(
      service.createAndPublish('user-1', {
        spotId: 'spot-1',
        startsAt: new Date('2026-01-01T06:00:00Z'),
        endsAt: new Date('2026-01-01T08:00:00Z'),
        mediaIds: ['media-1', 'media-2'],
        photoPrice: 300,
        videoPrice: 500,
      }),
    ).rejects.toThrow(BadRequestError);

    expect(sessions.createAndPublish).not.toHaveBeenCalled();
    expect(sessions.findPublishableDraftMedia).toHaveBeenCalledWith('user-1', ['media-1', 'media-2']);
  });

  it('publishes a draft session for the authenticated photographer', async () => {
    vi.mocked(sessions.findById).mockResolvedValue({
      id: 'session-1',
      spotId: 'spot-1',
      photographerId: 'user-1',
      startsAt: new Date('2026-01-01T06:00:00Z'),
      endsAt: new Date('2026-01-01T08:00:00Z'),
      status: 'DRAFT',
      createdAt: new Date('2026-01-01T05:00:00Z'),
      spot: { id: 'spot-1', name: 'Pipeline', location: 'North Shore' },
      thumbnailUrl: null,
      mediaCount: 1,
    });
    vi.mocked(sessions.publish).mockResolvedValue({ mediaIds: ['media-1'] });

    const result = await service.publish('user-1', 'session-1');

    expect(result).toEqual({ mediaIds: ['media-1'] });
    expect(sessions.publish).toHaveBeenCalledWith('session-1', 'user-1');
  });

  it('throws NotFoundError when the session is missing', async () => {
    vi.mocked(sessions.findById).mockResolvedValue(null);

    await expect(service.publish('user-1', 'missing-session')).rejects.toThrow(NotFoundError);

    expect(sessions.publish).not.toHaveBeenCalled();
  });

  it('throws ForbiddenError when the session belongs to another photographer', async () => {
    vi.mocked(sessions.findById).mockResolvedValue({
      id: 'session-1',
      spotId: 'spot-1',
      photographerId: 'other-user',
      startsAt: new Date('2026-01-01T06:00:00Z'),
      endsAt: new Date('2026-01-01T08:00:00Z'),
      status: 'DRAFT',
      createdAt: new Date('2026-01-01T05:00:00Z'),
      spot: { id: 'spot-1', name: 'Pipeline', location: 'North Shore' },
      thumbnailUrl: null,
      mediaCount: 1,
    });

    await expect(service.publish('user-1', 'session-1')).rejects.toThrow(ForbiddenError);

    expect(sessions.publish).not.toHaveBeenCalled();
  });

  it('throws BadRequestError when the session is already published', async () => {
    vi.mocked(sessions.findById).mockResolvedValue({
      id: 'session-1',
      spotId: 'spot-1',
      photographerId: 'user-1',
      startsAt: new Date('2026-01-01T06:00:00Z'),
      endsAt: new Date('2026-01-01T08:00:00Z'),
      status: 'PUBLISHED',
      createdAt: new Date('2026-01-01T05:00:00Z'),
      spot: { id: 'spot-1', name: 'Pipeline', location: 'North Shore' },
      thumbnailUrl: null,
      mediaCount: 1,
    });

    await expect(service.publish('user-1', 'session-1')).rejects.toThrow(BadRequestError);

    expect(sessions.publish).not.toHaveBeenCalled();
  });

  it('throws BadRequestError when the session is deleted', async () => {
    vi.mocked(sessions.findById).mockResolvedValue({
      id: 'session-1',
      spotId: 'spot-1',
      photographerId: 'user-1',
      startsAt: new Date('2026-01-01T06:00:00Z'),
      endsAt: new Date('2026-01-01T08:00:00Z'),
      status: 'DELETED',
      createdAt: new Date('2026-01-01T05:00:00Z'),
      spot: { id: 'spot-1', name: 'Pipeline', location: 'North Shore' },
      thumbnailUrl: null,
      mediaCount: 1,
    });

    await expect(service.publish('user-1', 'session-1')).rejects.toThrow(BadRequestError);

    expect(sessions.publish).not.toHaveBeenCalled();
  });
});
