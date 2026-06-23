import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SurfSessionService } from './SurfSessionService';
import type { ISurfSessionRepository } from 'server/repositories/SurfSessionRepository';
import type { IUploadAttemptRepository } from 'server/repositories/UploadAttemptRepository';
import { BadRequestError, ForbiddenError, NotFoundError } from 'shared/errors';
import type { SurfSessionDraft } from 'shared/types/surfSession';

const sessions = {
  findDraftById: vi.fn(),
  updateDraft: vi.fn(),
  publish: vi.fn(),
} as unknown as ISurfSessionRepository;

const mockAttempts: Pick<IUploadAttemptRepository, 'hasBlockingAttempts'> = {
  hasBlockingAttempts: vi.fn(),
};

const service = new SurfSessionService(sessions, mockAttempts);

function makeDraft(overrides: Partial<SurfSessionDraft> = {}): SurfSessionDraft {
  return {
    id: 'session-1',
    spotId: 'spot-1',
    photographerId: 'user-1',
    startsAt: new Date('2026-01-01T06:00:00Z'),
    endsAt: new Date('2026-01-01T08:00:00Z'),
    photoPrice: 300,
    videoPrice: 500,
    status: 'DRAFT',
    createdAt: new Date('2026-01-01T05:00:00Z'),
    updatedAt: new Date('2026-01-01T05:00:00Z'),
    spot: { id: 'spot-1', name: 'Pipeline', location: 'North Shore' },
    mediaCount: 1,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(mockAttempts.hasBlockingAttempts).mockResolvedValue(false);
});

describe('SurfSessionService', () => {
  it('publishes a draft session for the authenticated photographer', async () => {
    vi.mocked(sessions.findDraftById).mockResolvedValue(makeDraft());
    vi.mocked(sessions.publish).mockResolvedValue({ mediaIds: ['media-1'] });

    const result = await service.publish('user-1', 'session-1');

    expect(result).toEqual({ mediaIds: ['media-1'] });
    expect(sessions.publish).toHaveBeenCalledWith('session-1', 'user-1');
  });

  it('rejects publishing an incomplete owned draft', async () => {
    vi.mocked(sessions.findDraftById).mockResolvedValue(makeDraft({
      spotId: null,
      startsAt: null,
      endsAt: null,
      spot: null,
    }));

    await expect(service.publish('user-1', 'session-1')).rejects.toThrow(BadRequestError);

    expect(sessions.publish).not.toHaveBeenCalled();
  });

  it('rejects publishing a draft whose start and end are equal', async () => {
    const timestamp = new Date('2026-01-01T08:00:00Z');
    vi.mocked(sessions.findDraftById).mockResolvedValue(makeDraft({
      startsAt: timestamp,
      endsAt: timestamp,
    }));

    await expect(service.publish('user-1', 'session-1')).rejects.toThrow(BadRequestError);

    expect(sessions.publish).not.toHaveBeenCalled();
  });

  it('rejects edits to another photographer\'s draft', async () => {
    vi.mocked(sessions.findDraftById).mockResolvedValue(makeDraft({
      spotId: null,
      photographerId: 'other-user',
      startsAt: null,
      endsAt: null,
      spot: null,
      mediaCount: 0,
    }));

    const updateDraft = () => (service as unknown as {
      updateDraft: (photographerId: string, sessionId: string, data: { spotId: string }) => Promise<unknown>;
    }).updateDraft('user-1', 'session-1', { spotId: 'spot-1' });

    await expect(Promise.resolve().then(updateDraft)).rejects.toThrow(ForbiddenError);

    expect(sessions.updateDraft).not.toHaveBeenCalled();
  });

  it('rejects a partial edit that would make the draft end before it starts', async () => {
    vi.mocked(sessions.findDraftById).mockResolvedValue(makeDraft());

    await expect(service.updateDraft('user-1', 'session-1', {
      startsAt: new Date('2026-01-01T09:00:00Z'),
    })).rejects.toThrow(BadRequestError);

    expect(sessions.updateDraft).not.toHaveBeenCalled();
  });

  it('throws NotFoundError when the session is missing', async () => {
    vi.mocked(sessions.findDraftById).mockResolvedValue(null);

    await expect(service.publish('user-1', 'missing-session')).rejects.toThrow(NotFoundError);

    expect(sessions.publish).not.toHaveBeenCalled();
  });

  it('throws ForbiddenError when the session belongs to another photographer', async () => {
    vi.mocked(sessions.findDraftById).mockResolvedValue(makeDraft({ photographerId: 'other-user' }));

    await expect(service.publish('user-1', 'session-1')).rejects.toThrow(ForbiddenError);

    expect(sessions.publish).not.toHaveBeenCalled();
  });

  it('throws BadRequestError when the session is already published', async () => {
    vi.mocked(sessions.findDraftById).mockResolvedValue(makeDraft({ status: 'PUBLISHED' }));

    await expect(service.publish('user-1', 'session-1')).rejects.toThrow(BadRequestError);

    expect(sessions.publish).not.toHaveBeenCalled();
  });

  it('throws BadRequestError when the session is deleted', async () => {
    vi.mocked(sessions.findDraftById).mockResolvedValue(makeDraft({ status: 'DELETED' }));

    await expect(service.publish('user-1', 'session-1')).rejects.toThrow(BadRequestError);

    expect(sessions.publish).not.toHaveBeenCalled();
  });

  it('rejects publish when there are blocking upload attempts', async () => {
    vi.mocked(sessions.findDraftById).mockResolvedValue(makeDraft());
    vi.mocked(mockAttempts.hasBlockingAttempts).mockResolvedValue(true);

    await expect(service.publish('user-1', 'session-1')).rejects.toThrow('active or failed upload attempts');
    expect(sessions.publish).not.toHaveBeenCalled();
  });
});
