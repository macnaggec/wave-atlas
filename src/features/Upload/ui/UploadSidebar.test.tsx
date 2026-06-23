import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SurfSessionDraft } from 'entities/SurfSession';
import { UploadSidebar } from './UploadSidebar';

const mocks = vi.hoisted(() => ({
  invalidateQueries: vi.fn(),
  notifyError: vi.fn(),
  publish: vi.fn(),
  updateDraft: vi.fn(),
}));

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
  };
});

vi.mock('entities/SurfSession', async (importOriginal) => {
  const actual = await importOriginal<typeof import('entities/SurfSession')>();
  return {
    ...actual,
    useUpdateSurfSessionDraft: () => ({ mutateAsync: mocks.updateDraft }),
  };
});

vi.mock('shared/lib/trpc', () => ({
  useTRPC: () => ({
    sessions: {
      draft: { queryKey: (draftId: string) => ['sessions', 'draft', draftId] },
    },
  }),
}));

vi.mock('shared/lib/notifications', () => ({
  notify: { error: mocks.notifyError },
}));

vi.mock('../model', () => ({
  useUploadQueue: () => ({ queue: [] }),
  usePublishUploadSession: () => ({
    filesErrorTick: 0,
    hasTriedPublish: false,
    isPending: false,
    publish: mocks.publish,
  }),
}));

vi.mock('./steps/UploadStep', () => ({ UploadStep: () => null }));

const draft = {
  id: 'draft-1',
  spotId: 'spot-1',
  photographerId: 'photographer-1',
  startsAt: new Date(2026, 5, 22, 6, 0),
  endsAt: new Date(2026, 5, 22, 10, 0),
  photoPrice: 300,
  videoPrice: 500,
  status: 'DRAFT',
  createdAt: new Date('2026-06-22T05:00:00.000Z'),
  updatedAt: new Date('2026-06-22T05:00:00.000Z'),
  spot: { id: 'spot-1', name: 'Spot One', location: 'Beach' },
  mediaCount: 0,
} satisfies SurfSessionDraft;

function renderSidebar() {
  return render(
    <MantineProvider>
      <UploadSidebar draft={draft} onCancel={vi.fn()} />
    </MantineProvider>,
  );
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe('UploadSidebar draft editing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.invalidateQueries.mockResolvedValue(undefined);
    mocks.updateDraft.mockResolvedValue({ id: draft.id });
  });

  it('keeps a changed price local until the photographer leaves the field', async () => {
    renderSidebar();
    const photoPriceInput = screen.getByDisplayValue('$3');

    photoPriceInput.focus();
    fireEvent.change(photoPriceInput, { target: { value: '7' } });

    expect(photoPriceInput).toHaveValue('$7');
    expect(mocks.updateDraft).not.toHaveBeenCalled();

    photoPriceInput.blur();

    await waitFor(() => {
      expect(mocks.updateDraft).toHaveBeenCalledWith({ draftId: draft.id, photoPrice: 700 });
    });
  });

  it('starts a later draft save only after the earlier save finishes', async () => {
    const firstSave = deferred<{ id: string }>();
    mocks.updateDraft
      .mockImplementationOnce(() => firstSave.promise)
      .mockResolvedValueOnce({ id: draft.id });
    renderSidebar();
    const photoPriceInput = screen.getByDisplayValue('$3');
    const videoPriceInput = screen.getByDisplayValue('$5');

    photoPriceInput.focus();
    fireEvent.change(photoPriceInput, { target: { value: '7' } });
    photoPriceInput.blur();
    await waitFor(() => expect(mocks.updateDraft).toHaveBeenCalledTimes(1));

    videoPriceInput.focus();
    fireEvent.change(videoPriceInput, { target: { value: '9' } });
    videoPriceInput.blur();

    expect(mocks.updateDraft).toHaveBeenCalledTimes(1);

    await act(async () => {
      firstSave.resolve({ id: draft.id });
      await firstSave.promise;
    });

    await waitFor(() => {
      expect(mocks.updateDraft).toHaveBeenNthCalledWith(2, { draftId: draft.id, videoPrice: 900 });
    });
  });

  it('keeps slider movement local until the photographer finishes the change', async () => {
    renderSidebar();
    const [rangeStart] = screen.getAllByRole('slider');

    act(() => rangeStart.focus());
    fireEvent.keyDown(rangeStart, { key: 'ArrowRight' });

    expect(screen.getByText('06:15 – 10:00')).not.toBeNull();
    expect(mocks.updateDraft).not.toHaveBeenCalled();

    fireEvent.keyUp(rangeStart, { key: 'ArrowRight' });

    await waitFor(() => {
      expect(mocks.updateDraft).toHaveBeenCalledWith({
        draftId: draft.id,
        startsAt: new Date(2026, 5, 22, 6, 15),
        endsAt: new Date(2026, 5, 22, 10, 0),
      });
    });
  });

  it('keeps the local price and notifies the photographer when saving fails', async () => {
    mocks.updateDraft.mockRejectedValueOnce(new Error('Network down'));
    renderSidebar();
    const photoPriceInput = screen.getByDisplayValue('$3');

    photoPriceInput.focus();
    fireEvent.change(photoPriceInput, { target: { value: '7' } });
    photoPriceInput.blur();

    await waitFor(() => {
      expect(mocks.notifyError).toHaveBeenCalledWith('Network down', 'Draft Save Failed');
    });
    expect(photoPriceInput).toHaveValue('$7');
  });

  it('waits for the latest draft values to save before publishing', async () => {
    const blurSave = deferred<{ id: string }>();
    const publishSave = deferred<{ id: string }>();
    mocks.updateDraft
      .mockImplementationOnce(() => blurSave.promise)
      .mockImplementationOnce(() => publishSave.promise);
    renderSidebar();
    const photoPriceInput = screen.getByDisplayValue('$3');

    photoPriceInput.focus();
    fireEvent.change(photoPriceInput, { target: { value: '7' } });
    photoPriceInput.blur();
    await waitFor(() => expect(mocks.updateDraft).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: 'Publish session' }));

    expect(mocks.publish).not.toHaveBeenCalled();

    await act(async () => {
      blurSave.resolve({ id: draft.id });
      await blurSave.promise;
    });
    await waitFor(() => expect(mocks.updateDraft).toHaveBeenCalledTimes(2));
    expect(mocks.publish).not.toHaveBeenCalled();

    await act(async () => {
      publishSave.resolve({ id: draft.id });
      await publishSave.promise;
    });

    await waitFor(() => expect(mocks.publish).toHaveBeenCalledOnce());
  });
});
