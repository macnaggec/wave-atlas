import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { describe, expect, it, vi } from 'vitest';
import type { GalleryCard } from '../../model';
import { UploadStatusLabel } from './UploadStatusLabel';

function renderLabel(items: GalleryCard[]) {
  return render(
    <MantineProvider>
      <UploadStatusLabel items={items} hasActiveUploads onOpen={vi.fn()} />
    </MantineProvider>,
  );
}

describe('UploadStatusLabel', () => {
  it('uses queue policy active counts for importing cards', () => {
    const items = [
      {
        kind: 'uploading',
        id: 'import-1',
        pipelineItem: {
          id: 'import-1',
          file: null,
          previewUrl: 'drive:import-1',
          status: 'importing',
          progress: 0,
        },
      },
    ] satisfies GalleryCard[];

    renderLabel(items);

    expect(screen.getByText('1 uploading')).not.toBeNull();
  });
});
