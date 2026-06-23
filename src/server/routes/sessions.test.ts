import { describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  process.env.BETTER_AUTH_URL = 'http://localhost:3000';
  process.env.GOOGLE_CLIENT_ID = 'test-client';
  process.env.GOOGLE_CLIENT_SECRET = 'test-secret';
});

const mocks = vi.hoisted(() => ({
  updateDraft: vi.fn(),
}));

vi.mock('server/services/SurfSessionService', () => ({
  surfSessionService: {
    create: vi.fn(),
    getDraft: vi.fn(),
    updateDraft: mocks.updateDraft,
    publish: vi.fn(),
  },
}));

vi.mock('server/repositories/SurfSessionRepository', () => ({
  surfSessionRepository: {
    findDraftMediaBySession: vi.fn(),
    listPublished: vi.fn(),
    findByPhotographer: vi.fn(),
    findPublishedById: vi.fn(),
  },
}));

vi.mock('server/services/MediaService', () => ({
  mediaService: { findPublishedBySession: vi.fn() },
}));

import { sessionsRouter } from './sessions';

describe('sessionsRouter.updateDraft', () => {
  it('rejects a persisted media price below the product floor', async () => {
    const caller = sessionsRouter.createCaller({
      session: {} as never,
      user: { id: 'user-1' } as never,
    });

    const updateDraft = () => (caller as unknown as {
      updateDraft: (input: { draftId: string; photoPrice: number }) => Promise<unknown>;
    }).updateDraft({
      draftId: '11111111-1111-4111-8111-111111111111',
      photoPrice: 299,
    });

    await expect(Promise.resolve().then(updateDraft)).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(mocks.updateDraft).not.toHaveBeenCalled();
  });
});
