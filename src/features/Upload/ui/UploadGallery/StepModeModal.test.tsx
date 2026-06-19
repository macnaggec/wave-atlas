import { screen } from '@testing-library/react';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { GalleryCard } from '../../model';
import type { UseGallerySelectionReturn } from 'shared/hooks/gallery';
import { StepModeModal } from './StepModeModal';

vi.mock('shared/ui/BaseGallery', () => ({
  BaseGallery: ({ items }: { items: GalleryCard[] }) => (
    <div aria-label="Upload cards">
      {items.map((item) => <div key={item.id}>{item.id}</div>)}
    </div>
  ),
  SelectionToolbar: () => null,
}));

vi.mock('./UploadCardRenderer', () => ({
  UploadCardRenderer: ({ item }: { item: GalleryCard }) => <div>{item.id}</div>,
}));

function selectionStub(): UseGallerySelectionReturn<GalleryCard> {
  return {
    selectedIds: [],
    selectedCount: 0,
    isAllSelected: false,
    selectedItems: [],
    isSelected: () => false,
    toggle: vi.fn(),
    selectAll: vi.fn(),
    clearSelection: vi.fn(),
    deselectItems: vi.fn(),
    hasSelection: false,
    isSelectionMode: false,
    enableSelectionMode: vi.fn(),
    disableSelectionMode: vi.fn(),
  };
}

function renderModal(ui: ReactNode) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

describe('StepModeModal', () => {
  it('lets the photographer fold the modal while uploads are still active', async () => {
    const onClose = vi.fn();
    const onDiscardAll = vi.fn();
    const onRemove = vi.fn();
    const cards = [
      {
        kind: 'uploading',
        id: 'media-1',
        pipelineItem: {
          id: 'upload-1',
          file: new File(['done'], 'done.jpg', { type: 'image/jpeg' }),
          previewUrl: 'blob:done',
          status: 'completed',
          progress: 100,
          mediaId: 'media-1',
        },
      },
      {
        kind: 'uploading',
        id: 'upload-2',
        pipelineItem: {
          id: 'upload-2',
          file: new File(['active'], 'active.jpg', { type: 'image/jpeg' }),
          previewUrl: 'blob:active',
          status: 'uploading',
          progress: 40,
        },
      },
    ] satisfies GalleryCard[];

    renderModal(
      <StepModeModal
        opened
        onClose={onClose}
        items={cards}
        selection={selectionStub()}
        onDiscardAll={onDiscardAll}
        onRemove={onRemove}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(onClose).toHaveBeenCalledOnce();
    expect(onDiscardAll).not.toHaveBeenCalled();
    expect(onRemove).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /Continue with/ })).toBeNull();
  });
});
