import { getMediaId, type GalleryCard } from './types';

const ACTIVE_UPLOAD_STATUSES = ['pending', 'signing', 'uploading', 'saving', 'importing'] as const;

function isActiveUploadCard(card: GalleryCard): boolean {
  return card.kind === 'uploading'
    && ACTIVE_UPLOAD_STATUSES.includes(card.pipelineItem.status as typeof ACTIVE_UPLOAD_STATUSES[number]);
}

export function getSelectableUploadCards(cards: GalleryCard[]): GalleryCard[] {
  return cards.filter(card => card.kind === 'draft' || getMediaId(card) !== undefined);
}

export function getPublishableMediaIds(cards: GalleryCard[]): string[] {
  return cards.flatMap(card => {
    const mediaId = getMediaId(card);
    return mediaId ? [mediaId] : [];
  });
}

export function getUploadQueueStatus(cards: GalleryCard[]) {
  const completedItems = getSelectableUploadCards(cards);
  const errorCards = cards.filter(card => card.kind === 'uploading' && card.pipelineItem.status === 'error');
  const hasActiveUploads = cards.some(isActiveUploadCard);
  const uploadingCount = cards.filter(isActiveUploadCard).length;

  return {
    completedItems,
    errorCards,
    hasActiveUploads,
    uploadingCount,
    canContinue: !hasActiveUploads && completedItems.length > 0 && errorCards.length === 0,
  };
}
