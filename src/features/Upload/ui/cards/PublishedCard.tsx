import { memo } from 'react';
import { Badge, Group } from '@mantine/core';
import { BaseCard } from 'shared/ui/BaseGallery';
import { formatPrice } from 'shared/lib/currency';
import { formatShortDate } from 'shared/lib/dateUtils';

export interface PublishedUploadItem {
  id: string;
  type: string;
  url: string;
  thumbnailUrl: string;
  price: number;
  capturedAt: Date | null;
  spotId: string;
  spotName: string | null;
}

interface PublishedCardProps {
  item: PublishedUploadItem;
  onClick?: () => void;
}

/**
 * Gallery card for a published upload on the owner's uploads tab.
 * Displays price, capture date, and spot name as badges.
 */
export const PublishedCard = memo(({ item, onClick }: PublishedCardProps) => {
  const formattedDate = item.capturedAt ? formatShortDate(item.capturedAt) : null;

  return (
    <BaseCard
      imageUrl={item.thumbnailUrl}
      resourceType={item.type === 'VIDEO' ? 'video' : 'image'}
      alt={`Upload ${item.id}`}
      onClick={onClick}
      overlays={
        <Group gap={4}>
          <Badge size="sm" color="green" variant="filled">{formatPrice(item.price)}</Badge>
          {formattedDate && <Badge size="sm" color="blue" variant="filled">{formattedDate}</Badge>}
          {item.spotName && <Badge size="sm" color="gray" variant="light">{item.spotName}</Badge>}
        </Group>
      }
    />
  );
});

PublishedCard.displayName = 'PublishedCard';
