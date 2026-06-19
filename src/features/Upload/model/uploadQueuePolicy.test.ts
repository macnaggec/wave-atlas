import { describe, expect, it } from 'vitest';
import type { MediaItem } from 'entities/Media';
import type { GalleryCard } from './types';
import { getUploadQueueStatus } from './uploadQueuePolicy';

function mediaItem(id: string): MediaItem {
  return {
    id,
    photographerId: 'photographer-1',
    spotId: null,
    capturedAt: new Date('2026-01-01T00:00:00Z'),
    price: null,
    lightboxUrl: `https://cdn.example.com/${id}.jpg`,
    thumbnailUrl: `https://cdn.example.com/${id}-thumb.jpg`,
    cloudinaryPublicId: id,
    status: 'DRAFT',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    resource: {
      resourceType: 'image',
      url: `https://cdn.example.com/${id}.jpg`,
      assetId: `asset-${id}`,
    },
  };
}

describe('getUploadQueueStatus', () => {
  it('reports saved draft and completed upload cards as ready items', () => {
    const cards = [
      { kind: 'draft', id: 'draft-1', result: mediaItem('draft-1') },
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
      {
        kind: 'uploading',
        id: 'upload-3',
        pipelineItem: {
          id: 'upload-3',
          file: new File(['failed'], 'failed.jpg', { type: 'image/jpeg' }),
          previewUrl: 'blob:failed',
          status: 'error',
          progress: 0,
          error: 'Upload failed',
        },
      },
    ] satisfies GalleryCard[];

    const status = getUploadQueueStatus(cards);

    expect(status.readyItems.map((card) => card.id)).toEqual(['draft-1', 'media-1']);
    expect(status.canContinue).toBe(false);
  });
});
